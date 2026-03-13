import { Database } from "bun:sqlite";
import type { ArtifactFilterParams, ArtifactSummary } from "../shared/view-rpc";
import { PIWORK_ARTIFACT_INDEX_DB } from "./piwork-paths";

type ArtifactRow = {
	id: string;
	chat_id: string;
	created_by_chat_id: string;
	created_by_message_id: string | null;
	title: string;
	kind: string;
	file_name: string;
	path: string;
	created_at: string;
	updated_at: string;
	excerpt: string;
};

let db: Database | null = null;

const SCHEMA = `
DROP TABLE IF EXISTS artifact_tags;
DROP TABLE IF EXISTS artifacts;

CREATE TABLE artifacts (
	id TEXT PRIMARY KEY,
	chat_id TEXT NOT NULL,
	created_by_chat_id TEXT NOT NULL,
	created_by_message_id TEXT,
	title TEXT NOT NULL,
	kind TEXT NOT NULL,
	file_name TEXT NOT NULL,
	path TEXT NOT NULL,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	excerpt TEXT NOT NULL
);

CREATE TABLE artifact_tags (
	artifact_id TEXT NOT NULL,
	tag TEXT NOT NULL,
	PRIMARY KEY (artifact_id, tag)
);

CREATE INDEX idx_artifacts_updated_at ON artifacts(updated_at DESC);
CREATE INDEX idx_artifacts_kind ON artifacts(kind);
CREATE INDEX idx_artifacts_chat_id ON artifacts(created_by_chat_id);
CREATE INDEX idx_artifact_tags_tag ON artifact_tags(tag);
`;

const ensureDb = (): Database => {
	if (!db) throw new Error("Artifact index is not initialized.");
	return db;
};

const normalizeTags = (tags: string[]): string[] =>
	Array.from(
		new Set(
			tags
				.map((tag) => tag.trim().toLowerCase())
				.filter(Boolean),
		),
	).sort((left, right) => left.localeCompare(right));

const rowsToSummaries = (rows: ArtifactRow[]): ArtifactSummary[] => {
	const database = ensureDb();
	const tagRows = database
		.query("SELECT artifact_id, tag FROM artifact_tags WHERE artifact_id IN (" + rows.map(() => "?").join(", ") + ") ORDER BY tag ASC")
		.all(...rows.map((row) => row.id)) as { artifact_id: string; tag: string }[];

	const tagsByArtifact = new Map<string, string[]>();
	for (const row of tagRows) {
		const tags = tagsByArtifact.get(row.artifact_id) ?? [];
		tags.push(row.tag);
		tagsByArtifact.set(row.artifact_id, tags);
	}

	return rows.map((row) => ({
		id: row.id,
		chatId: row.chat_id,
		createdByChatId: row.created_by_chat_id,
		createdByMessageId: row.created_by_message_id ?? undefined,
		title: row.title,
		kind: row.kind as ArtifactSummary["kind"],
		fileName: row.file_name,
		path: row.path,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
		excerpt: row.excerpt,
		tags: tagsByArtifact.get(row.id) ?? [],
	}));
};

export const initArtifactIndex = (): void => {
	db = new Database(PIWORK_ARTIFACT_INDEX_DB, { create: true });
	db.exec("PRAGMA journal_mode=WAL;");
	db.exec(SCHEMA);
};

export const upsertArtifactIndex = (artifact: ArtifactSummary): void => {
	const database = ensureDb();
	const tags = normalizeTags(artifact.tags);
	const tx = database.transaction(() => {
		database.query(
			`INSERT OR REPLACE INTO artifacts
			(id, chat_id, created_by_chat_id, created_by_message_id, title, kind, file_name, path, created_at, updated_at, excerpt)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		).run(
			artifact.id,
			artifact.chatId,
			artifact.createdByChatId,
			artifact.createdByMessageId ?? null,
			artifact.title,
			artifact.kind,
			artifact.fileName,
			artifact.path,
			artifact.createdAt,
			artifact.updatedAt,
			artifact.excerpt,
		);
		database.query("DELETE FROM artifact_tags WHERE artifact_id = ?").run(artifact.id);
		for (const tag of tags) {
			database.query("INSERT INTO artifact_tags (artifact_id, tag) VALUES (?, ?)").run(artifact.id, tag);
		}
	});
	tx();
};

export const removeArtifactFromIndex = (artifactId: string): void => {
	const database = ensureDb();
	const tx = database.transaction(() => {
		database.query("DELETE FROM artifact_tags WHERE artifact_id = ?").run(artifactId);
		database.query("DELETE FROM artifacts WHERE id = ?").run(artifactId);
	});
	tx();
};

export const replaceArtifactIndex = (artifacts: ArtifactSummary[]): void => {
	const database = ensureDb();
	const insertArtifact = database.query(
		`INSERT OR REPLACE INTO artifacts
		(id, chat_id, created_by_chat_id, created_by_message_id, title, kind, file_name, path, created_at, updated_at, excerpt)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
	);
	const insertTag = database.query("INSERT INTO artifact_tags (artifact_id, tag) VALUES (?, ?)");
	const tx = database.transaction(() => {
		database.query("DELETE FROM artifact_tags").run();
		database.query("DELETE FROM artifacts").run();
		for (const artifact of artifacts) {
			insertArtifact.run(
				artifact.id,
				artifact.chatId,
				artifact.createdByChatId,
				artifact.createdByMessageId ?? null,
				artifact.title,
				artifact.kind,
				artifact.fileName,
				artifact.path,
				artifact.createdAt,
				artifact.updatedAt,
				artifact.excerpt,
			);
			for (const tag of normalizeTags(artifact.tags)) {
				insertTag.run(artifact.id, tag);
			}
		}
	});
	tx();
};

export const queryArtifactsFromIndex = (filters?: ArtifactFilterParams): ArtifactSummary[] => {
	const database = ensureDb();
	const where: string[] = [];
	const params: Array<string> = [];

	if (filters?.kind) {
		where.push("a.kind = ?");
		params.push(filters.kind);
	}
	if (filters?.chatId) {
		where.push("a.created_by_chat_id = ?");
		params.push(filters.chatId);
	}
	if (filters?.tags && filters.tags.length > 0) {
		const normalized = normalizeTags(filters.tags);
		if (normalized.length > 0) {
			where.push(
				`a.id IN (
					SELECT artifact_id
					FROM artifact_tags
					WHERE tag IN (${normalized.map(() => "?").join(", ")})
					GROUP BY artifact_id
					HAVING COUNT(DISTINCT tag) = ${normalized.length}
				)`,
			);
			params.push(...normalized);
		}
	}

	const sql = `
		SELECT
			a.id,
			a.chat_id,
			a.created_by_chat_id,
			a.created_by_message_id,
			a.title,
			a.kind,
			a.file_name,
			a.path,
			a.created_at,
			a.updated_at,
			a.excerpt
		FROM artifacts a
		${where.length > 0 ? `WHERE ${where.join(" AND ")}` : ""}
		ORDER BY a.updated_at DESC
	`;
	const rows = database.query(sql).all(...params) as ArtifactRow[];
	if (rows.length === 0) return [];
	return rowsToSummaries(rows);
};

export const listArtifactTagsFromIndex = (): string[] => {
	const database = ensureDb();
	const rows = database.query("SELECT DISTINCT tag FROM artifact_tags ORDER BY tag ASC").all() as { tag: string }[];
	return rows.map((row) => row.tag);
};
