import { Database } from "bun:sqlite";
import { readdir, readFile, stat } from "node:fs/promises";
import { relative, basename, extname } from "node:path";
import { PIWORK_SEARCH_DB_PATH } from "./piwork-paths";
import * as embedding from "./embedding-pipeline";

const DB_PATH = PIWORK_SEARCH_DB_PATH;
const DEFAULT_PATTERN = "**/*.md";
const BATCH_SIZE = 64;
const RRF_K = 60; // Reciprocal rank fusion constant

export interface SearchCollectionConfig {
	name: string;
	path: string;
	pattern: string;
}

export interface SearchResult {
	file: string;
	displayPath: string;
	title: string;
	docid: string;
	context: string | null;
	score: number;
	snippet: string;
	source: "search" | "query";
}

export interface SearchStatus {
	status: "unconfigured" | "indexing" | "embedding" | "ready" | "error";
	semanticSearchEnabled: boolean;
	collections: number;
	totalDocuments: number;
	hasVectorIndex: boolean;
	needsEmbeddingCount: number;
	lastError: string | null;
}

// ── Helpers ──

const log = (msg: string) => console.log(`[piwork:search] ${msg}`);

const extractTitle = (content: string, filePath: string): string => {
	const firstLine = content.split("\n").find((l) => l.trim().length > 0) ?? "";
	if (firstLine.startsWith("# ")) return firstLine.slice(2).trim();
	if (firstLine.startsWith("---")) {
		const titleMatch = content.match(/^title:\s*(.+)$/m);
		if (titleMatch) return titleMatch[1].trim().replace(/^['"]|['"]$/g, "");
	}
	return basename(filePath, extname(filePath));
};

const makeSnippet = (content: string, maxLen = 500): string => {
	const text = content.replace(/^---[\s\S]*?---\n?/, "").replace(/^#+\s+.+\n?/, "").trim();
	return text.length > maxLen ? text.slice(0, maxLen) + "..." : text;
};

const scanFiles = async (dir: string, pattern: string): Promise<string[]> => {
	const glob = new Bun.Glob(pattern);
	const results: string[] = [];
	for await (const path of glob.scan({ cwd: dir, absolute: true, dot: false })) {
		results.push(path);
	}
	if (results.length === 0) {
		// Diagnostic: try a plain readdir to see if the dir is accessible at all
		try {
			const entries = await readdir(dir);
			log(`diagnostic: readdir("${dir}") returned ${entries.length} entries (first 5: ${entries.slice(0, 5).join(", ")})`);
		} catch (err) {
			log(`diagnostic: readdir("${dir}") threw: ${err instanceof Error ? err.message : String(err)}`);
		}
	}
	return results;
};

const vecToBlob = (vec: Float32Array): Buffer => Buffer.from(vec.buffer, vec.byteOffset, vec.byteLength);

const cosineDistance = (a: Float32Array, b: Float32Array): number => {
	const len = Math.min(a.length, b.length);
	let dot = 0, normA = 0, normB = 0;
	for (let i = 0; i < len; i++) {
		dot += a[i] * b[i];
		normA += a[i] * a[i];
		normB += b[i] * b[i];
	}
	const denom = Math.sqrt(normA) * Math.sqrt(normB);
	return denom === 0 ? 1 : 1 - dot / denom;
};

/** Build a safe FTS5 query from user text.
 *  - Strips special FTS5 characters
 *  - Deduplicates terms
 *  - Uses OR for queries with many terms (>3) so partial matches surface
 *  - Caps at 16 terms to keep queries fast */
const buildFtsQuery = (query: string): string => {
	const raw = query.replace(/[":(){}[\]*^~]/g, " ").replace(/\s+/g, " ").trim();
	if (!raw) return "";
	const terms = [...new Set(raw.toLowerCase().split(" "))].slice(0, 16);
	if (terms.length <= 3) return terms.join(" "); // implicit AND for short queries
	return terms.join(" OR ");
};

// ── SearchEngine ──

export class SearchEngine {
	private db: Database | null = null;
	private collections: SearchCollectionConfig[] = [];
	private _status: SearchStatus["status"] = "unconfigured";
	private semanticSearchEnabled = false;
	private lastError: string | null = null;
	private indexPromise: Promise<void> | null = null;
	private totalDocuments = 0;
	private hasVectorIndex = false;
	private needsEmbeddingCount = 0;
	private embeddingAvailable = false;

	async initialize(
		collections: SearchCollectionConfig[],
		options?: { semanticSearchEnabled?: boolean },
	): Promise<void> {
		await this.waitForIdle();
		this.collections = collections.map((c) => ({
			name: c.name,
			path: c.path,
			pattern: c.pattern || DEFAULT_PATTERN,
		}));
		this.semanticSearchEnabled = options?.semanticSearchEnabled === true;

		if (this.collections.length === 0) {
			await this.close();
			this._status = "unconfigured";
			this.lastError = null;
			this.totalDocuments = 0;
			this.hasVectorIndex = false;
			this.needsEmbeddingCount = 0;
			return;
		}

		this.openDb();
		this._status = "ready";
		this.lastError = null;
		this.embeddingAvailable = embedding.isAvailable();
		log(`embedding available: ${this.embeddingAvailable}`);
		this.startReindexAll();
	}

	isAvailable(): boolean {
		return this.db !== null && this.collections.length > 0;
	}

	async getStatus(): Promise<SearchStatus> {
		this.refreshStatus();
		return {
			status: this._status,
			semanticSearchEnabled: this.semanticSearchEnabled,
			collections: this.collections.length,
			totalDocuments: this.totalDocuments,
			hasVectorIndex: this.hasVectorIndex,
			needsEmbeddingCount: this.needsEmbeddingCount,
			lastError: this.lastError,
		};
	}

	getCollectionNames(): string[] {
		return this.collections.map((c) => c.name);
	}

	isSemanticEnabled(): boolean {
		return this.semanticSearchEnabled;
	}

	setSemanticSearchEnabled(enabled: boolean): void {
		this.semanticSearchEnabled = enabled;
		this.lastError = null;
		if (!this.db || this.collections.length === 0) {
			this._status = this.collections.length === 0 ? "unconfigured" : "ready";
			return;
		}
		if (enabled) {
			this.embeddingAvailable = embedding.isAvailable();
			this.startReindexAll();
			return;
		}
		if (this._status !== "indexing") {
			this._status = "ready";
		}
	}

	async search(
		query: string,
		options?: { limit?: number; collection?: string },
	): Promise<SearchResult[]> {
		if (!this.db) return [];

		try {
			const limit = options?.limit ?? 10;
			const escaped = buildFtsQuery(query);
			if (!escaped) return [];

			let sql: string;
			const params: (string | number)[] = [];

			if (options?.collection) {
				sql = `
					SELECT d.docid, d.collection, d.filepath, d.title, d.body, d.fts_rowid,
					       (SELECT rank FROM documents_fts WHERE rowid = d.fts_rowid AND documents_fts MATCH ?) AS score
					FROM documents d
					WHERE d.collection = ?
					  AND d.fts_rowid IN (SELECT rowid FROM documents_fts WHERE documents_fts MATCH ?)
					ORDER BY score
					LIMIT ?
				`;
				params.push(escaped, options.collection, escaped, limit);
			} else {
				sql = `
					SELECT d.docid, d.collection, d.filepath, d.title, d.body,
					       fts.rank AS score
					FROM documents_fts fts
					JOIN documents d ON d.fts_rowid = fts.rowid
					WHERE documents_fts MATCH ?
					ORDER BY fts.rank
					LIMIT ?
				`;
				params.push(escaped, limit);
			}

			const rows = this.db.prepare(sql).all(...params) as Array<{
				docid: string;
				collection: string;
				filepath: string;
				title: string;
				body: string;
				score: number;
			}>;

			return rows.map((r) => ({
				file: r.filepath,
				displayPath: `@${r.collection}`,
				title: r.title,
				docid: r.docid,
				context: this.getContextForDoc(r.collection, r.filepath),
				score: r.score,
				snippet: makeSnippet(r.body),
				source: "search" as const,
			}));
		} catch (error) {
			log(`search error: ${error instanceof Error ? error.message : String(error)}`);
			return [];
		}
	}

	async query(
		query: string,
		options?: { limit?: number; collection?: string; intent?: string },
	): Promise<SearchResult[]> {
		if (!this.db) return [];
		if (!this.semanticSearchEnabled || !this.hasVectorIndex || this._status !== "ready") {
			return this.search(query, options);
		}

		try {
			const queryVec = embedding.embedText(options?.intent ? `${options.intent}: ${query}` : query);
			if (!queryVec) return this.search(query, options);

			const limit = options?.limit ?? 10;
			const fetchLimit = limit * 3;

			// Lexical results
			const lexResults = await this.search(query, { ...options, limit: fetchLimit });

			// Vector results
			let vecSql = `
				SELECT d.docid, d.collection, d.filepath, d.title, d.body, d.embedding
				FROM documents d
				WHERE d.embedding IS NOT NULL
			`;
			const vecParams: (string | number)[] = [];
			if (options?.collection) {
				vecSql += " AND d.collection = ?";
				vecParams.push(options.collection);
			}

			const embeddedRows = this.db.prepare(vecSql).all(...vecParams) as Array<{
				docid: string; collection: string; filepath: string; title: string; body: string; embedding: Buffer;
			}>;

			const vecRows = embeddedRows
				.map((r) => {
					const docVec = new Float32Array(r.embedding.buffer, r.embedding.byteOffset, r.embedding.byteLength / 4);
					return { ...r, distance: cosineDistance(queryVec, docVec) };
				})
				.sort((a, b) => a.distance - b.distance)
				.slice(0, fetchLimit);

			// RRF merge
			const scores = new Map<string, { score: number; row: { docid: string; collection: string; filepath: string; title: string; body: string } }>();
			for (let i = 0; i < lexResults.length; i++) {
				const r = lexResults[i];
				const rrfScore = 1 / (RRF_K + i + 1);
				scores.set(r.docid, { score: rrfScore, row: { docid: r.docid, collection: r.displayPath.slice(1), filepath: r.file, title: r.title, body: r.snippet } });
			}
			for (let i = 0; i < vecRows.length; i++) {
				const r = vecRows[i];
				const rrfScore = 1 / (RRF_K + i + 1);
				const existing = scores.get(r.docid);
				if (existing) {
					existing.score += rrfScore;
				} else {
					scores.set(r.docid, { score: rrfScore, row: r });
				}
			}

			const merged = Array.from(scores.values())
				.sort((a, b) => b.score - a.score)
				.slice(0, limit);

			return merged.map(({ score, row }) => ({
				file: row.filepath,
				displayPath: `@${row.collection}`,
				title: row.title,
				docid: row.docid,
				context: this.getContextForDoc(row.collection, row.filepath),
				score,
				snippet: makeSnippet(row.body),
				source: "query" as const,
			}));
		} catch (error) {
			log(`query error: ${error instanceof Error ? error.message : String(error)}`);
			return this.search(query, options);
		}
	}

	async get(pathOrDocid: string): Promise<Record<string, unknown> | null> {
		if (!this.db) return null;
		const row = this.db
			.prepare("SELECT docid, collection, filepath, title, body FROM documents WHERE docid = ? OR filepath = ? LIMIT 1")
			.get(pathOrDocid, pathOrDocid) as { docid: string; collection: string; filepath: string; title: string; body: string } | null;
		if (!row) return null;
		return {
			docid: row.docid,
			collection: row.collection,
			filepath: row.filepath,
			title: row.title,
			body: row.body,
			displayPath: `@${row.collection}`,
		};
	}

	async multiGet(
		pattern: string,
		options?: { includeBody?: boolean; maxBytes?: number },
	): Promise<{ docs: Array<Record<string, unknown>>; errors: string[] }> {
		if (!this.db) return { docs: [], errors: ["Store not initialized"] };

		const includeBody = options?.includeBody ?? true;
		const maxBytes = options?.maxBytes ?? Infinity;
		const errors: string[] = [];

		const patterns = pattern.includes(",") ? pattern.split(",").map((p) => p.trim()) : [pattern];
		const docs: Array<Record<string, unknown>> = [];
		let totalBytes = 0;

		for (const pat of patterns) {
			const isGlob = pat.includes("*") || pat.includes("?");
			let rows: Array<{ docid: string; collection: string; filepath: string; title: string; body: string }>;
			if (isGlob) {
				const glob = new Bun.Glob(pat);
				rows = (this.db.prepare("SELECT docid, collection, filepath, title, body FROM documents").all() as typeof rows)
					.filter((r) => glob.match(relative(this.getCollectionPath(r.collection) ?? "", r.filepath)));
			} else {
				const row = this.db
					.prepare("SELECT docid, collection, filepath, title, body FROM documents WHERE filepath = ? OR docid = ? LIMIT 1")
					.get(pat, pat) as typeof rows[0] | null;
				rows = row ? [row] : [];
				if (!row) errors.push(`Not found: ${pat}`);
			}

			for (const r of rows) {
				const bodySize = Buffer.byteLength(r.body, "utf-8");
				if (totalBytes + bodySize > maxBytes) {
					docs.push({
						docid: r.docid,
						collection: r.collection,
						filepath: r.filepath,
						title: r.title,
						displayPath: `@${r.collection}`,
						skipped: true,
						reason: "maxBytes exceeded",
					});
					continue;
				}
				totalBytes += bodySize;
				docs.push({
					docid: r.docid,
					collection: r.collection,
					filepath: r.filepath,
					title: r.title,
					displayPath: `@${r.collection}`,
					...(includeBody ? { body: r.body } : {}),
				});
			}
		}

		return { docs, errors };
	}

	async addContext(collectionName: string, pathPrefix: string, contextText: string): Promise<boolean> {
		if (!this.db) return false;
		this.db.prepare(
			"INSERT OR REPLACE INTO contexts (collection, path_prefix, context_text) VALUES (?, ?, ?)",
		).run(collectionName, pathPrefix, contextText);
		return true;
	}

	async removeContext(collectionName: string, pathPrefix: string): Promise<boolean> {
		if (!this.db) return false;
		this.db.prepare("DELETE FROM contexts WHERE collection = ? AND path_prefix = ?").run(collectionName, pathPrefix);
		return true;
	}

	async listContexts(): Promise<Array<{ collection: string; path: string; context: string }>> {
		if (!this.db) return [];
		return this.db.prepare("SELECT collection, path_prefix AS path, context_text AS context FROM contexts").all() as Array<{
			collection: string;
			path: string;
			context: string;
		}>;
	}

	async close(): Promise<void> {
		this.db?.close();
		this.db = null;
	}

	// ── Private ──

	private getCollectionPath(name: string): string | undefined {
		return this.collections.find((c) => c.name === name)?.path;
	}

	private getContextForDoc(collection: string, filepath: string): string | null {
		if (!this.db) return null;
		const row = this.db
			.prepare(
				"SELECT context_text FROM contexts WHERE collection = ? AND ? LIKE (path_prefix || '%') ORDER BY LENGTH(path_prefix) DESC LIMIT 1",
			)
			.get(collection, filepath) as { context_text: string } | null;
		return row?.context_text ?? null;
	}

	private openDb(): void {
		if (this.db) return;
		this.db = new Database(DB_PATH, { create: true });
		this.db.exec("PRAGMA journal_mode = WAL;");
		this.db.exec("PRAGMA synchronous = NORMAL;");

		// Check if we need to migrate from old schema (content-sync FTS, no fts_rowid)
		const hasNewSchema = (() => {
			try {
				const cols = this.db!.prepare("PRAGMA table_info(documents)").all() as Array<{ name: string }>;
				return cols.some((c) => c.name === "fts_rowid");
			} catch {
				return false;
			}
		})();

		if (!hasNewSchema) {
			// Drop old tables/triggers and start fresh
			log("migrating to new schema (dropping old tables)");
			try { this.db.exec("DROP TRIGGER IF EXISTS documents_ai"); } catch {}
			try { this.db.exec("DROP TRIGGER IF EXISTS documents_ad"); } catch {}
			try { this.db.exec("DROP TRIGGER IF EXISTS documents_au"); } catch {}
			try { this.db.exec("DROP TABLE IF EXISTS documents_fts"); } catch {}
			try { this.db.exec("DROP TABLE IF EXISTS documents"); } catch {}
		}

		// Documents table — stores content + optional embedding vector
		this.db.exec(`
			CREATE TABLE IF NOT EXISTS documents (
				docid TEXT PRIMARY KEY,
				collection TEXT NOT NULL,
				filepath TEXT NOT NULL,
				title TEXT NOT NULL,
				body TEXT NOT NULL,
				mtime_ms INTEGER NOT NULL,
				embedding BLOB,
				fts_rowid INTEGER,
				UNIQUE(collection, filepath)
			);
			CREATE INDEX IF NOT EXISTS idx_documents_collection ON documents(collection);
			CREATE INDEX IF NOT EXISTS idx_documents_filepath ON documents(filepath);
		`);

		// Standalone FTS5 table — no content= option, stores its own copy of text
		this.db.exec(`
			CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(
				title, body,
				tokenize='porter unicode61'
			);
		`);

		this.db.exec(`
			CREATE TABLE IF NOT EXISTS contexts (
				collection TEXT NOT NULL,
				path_prefix TEXT NOT NULL,
				context_text TEXT NOT NULL,
				PRIMARY KEY(collection, path_prefix)
			);
		`);

		log(`db opened at ${DB_PATH}`);
	}

	private refreshStatus(): void {
		if (!this.db) {
			this.totalDocuments = 0;
			this.hasVectorIndex = false;
			this.needsEmbeddingCount = 0;
			return;
		}
		try {
			const countRow = this.db.prepare("SELECT COUNT(*) AS cnt FROM documents").get() as { cnt: number };
			this.totalDocuments = countRow.cnt;
			const embeddedRow = this.db.prepare("SELECT COUNT(*) AS cnt FROM documents WHERE embedding IS NOT NULL").get() as { cnt: number };
			this.hasVectorIndex = embeddedRow.cnt > 0;
			this.needsEmbeddingCount = this.totalDocuments - embeddedRow.cnt;
		} catch (error) {
			this.lastError = this.lastError ?? (error instanceof Error ? error.message : String(error));
		}
	}

	private startReindexAll(): void {
		if (this.collections.length === 0) {
			this._status = "unconfigured";
			this.lastError = null;
			return;
		}

		if (this.indexPromise) return;

		this._status = "indexing";
		this.lastError = null;
		this.indexPromise = this.runReindex()
			.catch((error) => {
				this._status = "error";
				this.lastError = error instanceof Error ? error.message : String(error);
				log(`reindex error: ${this.lastError}`);
			})
			.finally(() => {
				this.indexPromise = null;
			});
	}

	private async waitForIdle(): Promise<void> {
		if (this.indexPromise) {
			await this.indexPromise;
		}
	}

	private async runReindex(): Promise<void> {
		if (!this.db || this.collections.length === 0) {
			this._status = "unconfigured";
			this.lastError = null;
			this.totalDocuments = 0;
			this.hasVectorIndex = false;
			this.needsEmbeddingCount = 0;
			return;
		}

		const seenDocids = new Set<string>();
		let inserted = 0;
		let skipped = 0;

		for (const col of this.collections) {
			let files: string[];
			try {
				files = await scanFiles(col.path, col.pattern);
			} catch (error) {
				log(`walk error for ${col.name}: ${error instanceof Error ? error.message : String(error)}`);
				continue;
			}
			log(`${col.name}: found ${files.length} files`);

			for (const file of files) {
				try {
					const fileStat = await stat(file);
					const mtimeMs = Math.floor(fileStat.mtimeMs);
					const docid = `${col.name}:${relative(col.path, file)}`;
					seenDocids.add(docid);

					// Check if we already have this version
					const existing = this.db!.prepare("SELECT mtime_ms FROM documents WHERE docid = ?").get(docid) as { mtime_ms: number } | null;
					if (existing && existing.mtime_ms >= mtimeMs) {
						skipped++;
						continue;
					}

					const content = await readFile(file, "utf-8");
					const title = extractTitle(content, file);

					// Insert into FTS first, get the rowid
					const ftsResult = this.db!.prepare(
						"INSERT INTO documents_fts (title, body) VALUES (?, ?)",
					).run(title, content);
					const ftsRowid = Number(ftsResult.lastInsertRowid);

					// Delete old FTS row if updating
					if (existing) {
						const oldDoc = this.db!.prepare("SELECT fts_rowid FROM documents WHERE docid = ?").get(docid) as { fts_rowid: number | null } | null;
						if (oldDoc?.fts_rowid) {
							this.db!.prepare("DELETE FROM documents_fts WHERE rowid = ?").run(oldDoc.fts_rowid);
						}
					}

					// Upsert document with FTS rowid reference
					this.db!.prepare(`
						INSERT INTO documents (docid, collection, filepath, title, body, mtime_ms, embedding, fts_rowid)
						VALUES (?, ?, ?, ?, ?, ?, NULL, ?)
						ON CONFLICT(docid) DO UPDATE SET
							title = excluded.title,
							body = excluded.body,
							mtime_ms = excluded.mtime_ms,
							fts_rowid = excluded.fts_rowid,
							embedding = NULL
					`).run(docid, col.name, file, title, content, mtimeMs, ftsRowid);

					inserted++;
				} catch (error) {
					log(`index error for ${file}: ${error instanceof Error ? error.message : String(error)}`);
				}
			}
		}

		// Prune stale documents
		const collectionNames = this.collections.map((c) => c.name);
		const allDocs = this.db.prepare("SELECT docid, collection, fts_rowid FROM documents").all() as Array<{ docid: string; collection: string; fts_rowid: number | null }>;
		let pruned = 0;
		for (const doc of allDocs) {
			if (!collectionNames.includes(doc.collection) || !seenDocids.has(doc.docid)) {
				if (doc.fts_rowid) {
					this.db.prepare("DELETE FROM documents_fts WHERE rowid = ?").run(doc.fts_rowid);
				}
				this.db.prepare("DELETE FROM documents WHERE docid = ?").run(doc.docid);
				pruned++;
			}
		}

		this.refreshStatus();
		log(`reindex done: ${inserted} inserted, ${skipped} unchanged, ${pruned} pruned, ${this.totalDocuments} total`);

		// Embed if semantic search is enabled
		if (this.semanticSearchEnabled && this.embeddingAvailable && this.needsEmbeddingCount > 0) {
			this._status = "embedding";
			await this.runEmbedding();
			this.refreshStatus();
		}

		this._status = "ready";
		this.lastError = null;
	}

	private async runEmbedding(): Promise<void> {
		if (!this.db) return;

		const needsEmbedding = this.db
			.prepare("SELECT docid, body FROM documents WHERE embedding IS NULL")
			.all() as Array<{ docid: string; body: string }>;

		log(`embedding ${needsEmbedding.length} documents`);

		const updateStmt = this.db.prepare("UPDATE documents SET embedding = ? WHERE docid = ?");
		let embedded = 0;

		for (let i = 0; i < needsEmbedding.length; i += BATCH_SIZE) {
			const batch = needsEmbedding.slice(i, i + BATCH_SIZE);
			const texts = batch.map((d) => d.body.slice(0, 2000));
			const vectors = embedding.embedBatch(texts);

			const transaction = this.db.transaction(() => {
				for (let j = 0; j < batch.length; j++) {
					const vec = vectors[j];
					if (vec) {
						updateStmt.run(vecToBlob(vec), batch[j].docid);
						embedded++;
					}
				}
			});
			transaction();

			if (i + BATCH_SIZE < needsEmbedding.length) {
				await Bun.sleep(1);
			}
		}

		log(`embedded ${embedded}/${needsEmbedding.length} documents`);
	}
}
