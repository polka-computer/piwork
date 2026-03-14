import { Type, type Static } from "@sinclair/typebox";
import { StringEnum, type CustomTool } from "@oh-my-pi/pi-coding-agent";
import type { SearchEngine } from "./search-engine";

const PiworkSearchParams = Type.Object({
	action: StringEnum(["status", "search", "query", "get", "multi_get"] as const, {
		description:
			"status: check index state. search: BM25 keyword search. query: hybrid semantic search when enabled, otherwise lexical fallback (supports intent hint). get: retrieve full document by path or docid. multi_get: batch retrieve by glob pattern or paths array.",
	}),
	query: Type.Optional(
		Type.String({ description: "Search query text (required for search/query)" }),
	),
	path: Type.Optional(
		Type.String({ description: "File path or docid (required for get)" }),
	),
	paths: Type.Optional(
		Type.Array(Type.String(), { minItems: 1, maxItems: 20, description: "Array of file paths or docids (required for multi_get)" }),
	),
	collection: Type.Optional(
		Type.String({ description: "Limit search to a specific collection (workspace alias)" }),
	),
	limit: Type.Optional(
		Type.Integer({
			minimum: 1,
			maximum: 50,
			description: "Maximum number of results to return (default 10)",
		}),
	),
	intent: Type.Optional(
		Type.String({ description: "Domain intent hint for semantic search relevance (e.g. 'quarterly planning', 'API docs'). Only affects query action." }),
	),
	pattern: Type.Optional(
		Type.String({ description: "Glob pattern for multi_get (e.g. '**/*.md', 'docs/*.ts'). Alternative to paths array." }),
	),
	maxBytes: Type.Optional(
		Type.Integer({ minimum: 1024, description: "Max total bytes for multi_get results" }),
	),
});

type PiworkSearchInput = Static<typeof PiworkSearchParams>;

const jsonContent = (value: unknown) => ({
	content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
});

const textContent = (text: string) => ({
	content: [{ type: "text" as const, text }],
});

const log = (msg: string) => console.log(`[piwork:search-tool] ${msg}`);

export const createSearchTool = (
	searchEngine: SearchEngine,
): CustomTool<typeof PiworkSearchParams> => ({
	name: "piwork_search",
	label: "piwork Search",
	description:
		"Search across indexed workspace documents using keyword search, or semantic hybrid search when enabled. Use this to discover relevant documents before reading them with piwork_resources.",
	parameters: PiworkSearchParams,

	async execute(_toolCallId, params: PiworkSearchInput) {
		log(`action=${params.action} query=${params.query ?? ""} collection=${params.collection ?? "all"}`);
		try {
			switch (params.action) {
				case "status": {
					const status = await searchEngine.getStatus();
					const collections = searchEngine.getCollectionNames();
					log(`status: ${status.status}, totalDocs=${status.totalDocuments}, collections=${collections.join(",")}`);
					return jsonContent({ ...status, collections });
				}

				case "search": {
					const query = params.query?.trim();
					if (!query) return textContent("Error: query is required for search.");
					const results = await searchEngine.search(query, {
						limit: params.limit ?? 10,
						collection: params.collection,
					});
					log(`search "${query}": ${results.length} results`);
					if (results.length > 0) {
						log(`  top: ${results.slice(0, 3).map((r) => `${r.title} (${r.score.toFixed(3)})`).join(", ")}`);
					}
					return jsonContent({
						resultCount: results.length,
						results: results.map((r) => ({
							title: r.title,
							file: r.file,
							collection: r.displayPath,
							score: r.score,
							snippet: r.snippet.slice(0, 500),
						})),
					});
				}

				case "query": {
					const query = params.query?.trim();
					if (!query) return textContent("Error: query is required for query.");
					const results = await searchEngine.query(query, {
						limit: params.limit ?? 10,
						collection: params.collection,
						intent: params.intent,
					});
					log(`query "${query}": ${results.length} results (semantic=${searchEngine.isSemanticEnabled()})`);
					if (results.length > 0) {
						log(`  top: ${results.slice(0, 3).map((r) => `${r.title} (${r.score.toFixed(3)})`).join(", ")}`);
					}
					return jsonContent({
						resultCount: results.length,
						results: results.map((r) => ({
							title: r.title,
							file: r.file,
							collection: r.displayPath,
							score: r.score,
							snippet: r.snippet.slice(0, 500),
						})),
					});
				}

				case "get": {
					const pathOrDocid = params.path?.trim();
					if (!pathOrDocid) return textContent("Error: path is required for get.");
					const doc = await searchEngine.get(pathOrDocid);
					log(`get "${pathOrDocid}": ${doc ? "found" : "not found"}`);
					if (!doc) return textContent(`Document not found: ${pathOrDocid}`);
					return jsonContent(doc);
				}

				case "multi_get": {
					const pattern = params.pattern?.trim();
					const paths = params.paths;
					if (!pattern && !paths?.length) {
						return textContent("Error: either pattern or paths array is required for multi_get.");
					}
					const resolvedPattern = pattern || paths!.map((p) => p.trim()).join(",");
					const { docs, errors } = await searchEngine.multiGet(resolvedPattern, {
						includeBody: true,
						maxBytes: params.maxBytes,
					});
					log(`multi_get "${resolvedPattern}": ${docs.length} docs, ${errors.length} errors`);
					return jsonContent({
						pattern: resolvedPattern,
						found: docs.filter((d: any) => !d.skipped).length,
						total: docs.length,
						results: docs,
						errors: errors.length > 0 ? errors : undefined,
					});
				}

				default:
					log(`unknown action: ${params.action}`);
					return textContent(`Unknown piwork_search action: ${params.action}`);
			}
		} catch (error) {
			log(`error: ${error instanceof Error ? error.message : String(error)}`);
			return textContent(
				`Error: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	},
});
