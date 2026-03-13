import { PIWORK_QMD_DB_PATH } from "./piwork-paths";

type QMDStore = import("@tobilu/qmd").QMDStore;
type MultiGetResult = import("@tobilu/qmd").MultiGetResult;
type QmdRuntimeModule = {
	createStore: typeof import("@tobilu/qmd").createStore;
};

const QMD_DB_PATH = PIWORK_QMD_DB_PATH;
const DEFAULT_PATTERN = "**/*.md";

const countPendingEmbeddings = (value: number | unknown[] | null | undefined): number =>
	typeof value === "number" ? value : Array.isArray(value) ? value.length : 0;

export interface QmdCollectionConfig {
	name: string;
	path: string;
	pattern: string;
}

export interface QmdSearchResult {
	file: string;
	displayPath: string;
	title: string;
	docid: string;
	context: string | null;
	score: number;
	snippet: string;
	source: "search" | "query";
}

export interface QmdStatus {
	status: "unconfigured" | "indexing" | "embedding" | "ready" | "error";
	semanticSearchEnabled: boolean;
	collections: number;
	totalDocuments: number;
	hasVectorIndex: boolean;
	needsEmbeddingCount: number;
	lastError: string | null;
}

export class QmdManager {
	private store: QMDStore | null = null;
	private collections: QmdCollectionConfig[] = [];
	private status: QmdStatus["status"] = "unconfigured";
	private semanticSearchEnabled = false;
	private lastError: string | null = null;
	private indexPromise: Promise<void> | null = null;
	private qmdModulePromise: Promise<QmdRuntimeModule> | null = null;
	private totalDocuments = 0;
	private hasVectorIndex = false;
	private needsEmbeddingCount = 0;

	async initialize(
		collections: QmdCollectionConfig[],
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
			this.status = "unconfigured";
			this.lastError = null;
			this.totalDocuments = 0;
			this.hasVectorIndex = false;
			this.needsEmbeddingCount = 0;
			return;
		}

		await this.resetStore();
		this.status = "ready";
		this.lastError = null;
		this.startReindexAll();
	}

	isAvailable(): boolean {
		return this.store !== null && this.collections.length > 0;
	}

	async getStatus(): Promise<QmdStatus> {
		await this.refreshStoreStatus();
		return {
			status: this.status,
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

	setSemanticSearchEnabled(enabled: boolean): void {
		this.semanticSearchEnabled = enabled;
		this.lastError = null;
		if (!this.store || this.collections.length === 0) {
			this.status = this.collections.length === 0 ? "unconfigured" : "ready";
			return;
		}
		if (enabled) {
			this.startReindexAll();
			return;
		}
		if (this.status !== "indexing") {
			this.status = "ready";
		}
	}

	async search(
		query: string,
		options?: { limit?: number; collection?: string },
	): Promise<QmdSearchResult[]> {
		if (!this.store) return [];

		const results = await this.store.searchLex(query, {
			limit: options?.limit,
			collection: options?.collection,
		});
		return results.map((result) => ({
			file: result.filepath,
			displayPath: result.displayPath,
			title: result.title,
			docid: result.docid,
			context: result.context,
			score: result.score,
			snippet: result.body ?? "",
			source: "search" as const,
		}));
	}

	async query(
		query: string,
		options?: { limit?: number; collection?: string; intent?: string },
	): Promise<QmdSearchResult[]> {
		if (!this.store) return [];
		if (!this.semanticSearchEnabled || !this.hasVectorIndex || this.status !== "ready") {
			return this.search(query, options);
		}

		try {
			const results = await this.store.search({
				query,
				limit: options?.limit,
				collection: options?.collection,
				intent: options?.intent,
			});
			return results.map((result) => ({
				file: result.file,
				displayPath: result.displayPath,
				title: result.title,
				docid: result.docid,
				context: result.context,
				score: result.score,
				snippet: result.bestChunk || result.body,
				source: "query" as const,
			}));
		} catch {
			return this.search(query, options);
		}
	}

	async get(pathOrDocid: string): Promise<unknown> {
		if (!this.store) return null;
		return this.store.get(pathOrDocid, { includeBody: true });
	}

	async multiGet(
		pattern: string,
		options?: { includeBody?: boolean; maxBytes?: number },
	): Promise<{ docs: MultiGetResult[]; errors: string[] }> {
		if (!this.store) return { docs: [], errors: ["Store not initialized"] };
		return this.store.multiGet(pattern, {
			includeBody: options?.includeBody ?? true,
			maxBytes: options?.maxBytes,
		});
	}

	async addContext(collectionName: string, pathPrefix: string, contextText: string): Promise<boolean> {
		if (!this.store) return false;
		return this.store.addContext(collectionName, pathPrefix, contextText);
	}

	async removeContext(collectionName: string, pathPrefix: string): Promise<boolean> {
		if (!this.store) return false;
		return this.store.removeContext(collectionName, pathPrefix);
	}

	async listContexts(): Promise<Array<{ collection: string; path: string; context: string }>> {
		if (!this.store) return [];
		return this.store.listContexts();
	}

	async close(): Promise<void> {
		await this.store?.close();
		this.store = null;
	}

	private startReindexAll(): void {
		if (this.collections.length === 0) {
			this.status = "unconfigured";
			this.lastError = null;
			return;
		}

		if (this.indexPromise) return;

		this.status = "indexing";
		this.lastError = null;
		this.indexPromise = this.runReindex()
			.catch((error) => {
				this.status = "error";
				this.lastError = error instanceof Error ? error.message : String(error);
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

	private async resetStore(): Promise<void> {
		await this.store?.close();
		this.store = null;

		try {
			const { createStore } = await this.getQmdModule();
			this.store = await createStore({
				dbPath: QMD_DB_PATH,
				config: {
					collections: Object.fromEntries(
						this.collections.map((c) => [
							c.name,
							{ path: c.path, pattern: c.pattern },
						]),
					),
				},
			});
		} catch (error) {
			this.status = "error";
			this.lastError = error instanceof Error ? error.message : String(error);
			throw error;
		}
	}

	private async refreshStoreStatus(): Promise<void> {
		if (!this.store) {
			this.totalDocuments = 0;
			this.hasVectorIndex = false;
			this.needsEmbeddingCount = 0;
			return;
		}
		try {
			const status = await this.store.getStatus();
			this.totalDocuments = status.totalDocuments;
			this.hasVectorIndex = status.hasVectorIndex;
			this.needsEmbeddingCount = countPendingEmbeddings(status.needsEmbedding);
		} catch (error) {
			this.lastError = this.lastError ?? (error instanceof Error ? error.message : String(error));
		}
	}

	private async getQmdModule(): Promise<QmdRuntimeModule> {
		if (!this.qmdModulePromise) {
			this.qmdModulePromise = import("@tobilu/qmd");
		}
		return this.qmdModulePromise;
	}

	private async runReindex(): Promise<void> {
		if (!this.store || this.collections.length === 0) {
			this.status = "unconfigured";
			this.lastError = null;
			this.totalDocuments = 0;
			this.hasVectorIndex = false;
			this.needsEmbeddingCount = 0;
			return;
		}

		const updateResult = await this.store.update();
		this.needsEmbeddingCount = countPendingEmbeddings(updateResult.needsEmbedding);
		await this.refreshStoreStatus();
		if (this.semanticSearchEnabled && this.needsEmbeddingCount > 0) {
			this.status = "embedding";
			await this.store.embed();
			await this.refreshStoreStatus();
		}
		this.status = "ready";
		this.lastError = null;
	}
}
