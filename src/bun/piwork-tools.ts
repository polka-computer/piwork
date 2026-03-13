import { Type, type Static } from "@sinclair/typebox";
import { StringEnum, type CustomTool } from "@oh-my-pi/pi-coding-agent";
import * as homeFiles from "./home-files";
import * as store from "./piwork-store";

const PiworkResourcesParams = Type.Object({
	action: StringEnum(["list_workspaces", "list_files", "read_file"] as const, {
		description: "Read-only indexed workspace operations",
	}),
	alias: Type.Optional(Type.String({ description: "Workspace alias without the @ sign" })),
	path: Type.Optional(Type.String({ description: "Relative file path within the workspace" })),
	limit: Type.Optional(
		Type.Integer({
			minimum: 1,
			maximum: 200,
			description: "Maximum number of files to return for list_files",
		}),
	),
	maxChars: Type.Optional(
		Type.Integer({
			minimum: 200,
			maximum: 32000,
			description: "Maximum characters to read from a workspace file",
		}),
	),
});

type PiworkResourcesInput = Static<typeof PiworkResourcesParams>;

const PiworkArtifactsParams = Type.Object({
	action: StringEnum(["list", "create", "update", "read", "import_file"] as const, {
		description: "Artifact operations inside the managed piwork home folder's objects directory",
	}),
	artifactId: Type.Optional(Type.String({ description: "Artifact ID for update/read" })),
	title: Type.Optional(Type.String({ description: "Artifact title for create/update" })),
	content: Type.Optional(Type.String({ description: "Artifact content for create/update" })),
	fileName: Type.Optional(Type.String({ description: "Optional file name for create" })),
	sourcePath: Type.Optional(Type.String({ description: "Absolute path to a local file to import as an artifact" })),
	chatId: Type.Optional(Type.String({ description: "Optional creating chat filter for list" })),
	tags: Type.Optional(Type.Array(Type.String({ minLength: 1 }), { description: "Artifact tags for create/update or filters for list" })),
	kind: Type.Optional(
		StringEnum(["markdown", "csv", "json", "text", "image", "video", "other"] as const, {
			description: "Artifact type for create or list filtering",
		}),
	),
});

type PiworkArtifactsInput = Static<typeof PiworkArtifactsParams>;

const PiworkHomeParams = Type.Object({
	action: StringEnum([
		"read_memory",
		"remember_fact",
		"read_toc",
		"upsert_toc_entry",
		"read_links",
		"upsert_link",
		"read_daily",
		"append_daily",
	] as const, {
		description: "Operations on piwork's quick-access home files in the managed piwork home folder",
	}),
	section: Type.Optional(Type.String({ description: "Section name for memory, toc, or daily entry grouping" })),
	fact: Type.Optional(Type.String({ description: "Fact to remember in memory.md" })),
	label: Type.Optional(Type.String({ description: "TOC label for upsert_toc_entry" })),
	target: Type.Optional(Type.String({ description: "TOC target path or URL for upsert_toc_entry" })),
	description: Type.Optional(Type.String({ description: "Short description for toc.md entries" })),
	url: Type.Optional(Type.String({ description: "URL for links.csv upsert" })),
	title: Type.Optional(Type.String({ description: "Optional page/resource title" })),
	summary: Type.Optional(Type.String({ description: "Concise summary for links.csv" })),
	tags: Type.Optional(Type.Array(Type.String({ minLength: 1 }), { description: "Tags for links.csv entries" })),
	chatId: Type.Optional(Type.String({ description: "Associated chat id for link capture" })),
	date: Type.Optional(Type.String({ description: "Date in YYYY-MM-DD format for daily file access" })),
	content: Type.Optional(Type.String({ description: "Content to append to the daily note" })),
});

type PiworkHomeInput = Static<typeof PiworkHomeParams>;

type ArtifactWriteAction = "create" | "update";

const jsonContent = (value: unknown) => ({
	content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
});

const textContent = (text: string) => ({
	content: [{ type: "text" as const, text }],
});

const toErrorMessage = (error: unknown): string =>
	error instanceof Error ? error.message : String(error);

export const piworkResourcesTool: CustomTool<typeof PiworkResourcesParams> = {
	name: "piwork_resources",
	label: "piwork Resources",
	description:
		"Read indexed folders that the user added in settings. These folders are read-only context.",
	parameters: PiworkResourcesParams,

	async execute(_toolCallId, params: PiworkResourcesInput) {
		try {
			switch (params.action) {
				case "list_workspaces":
					return jsonContent(await store.listWorkspaces());

				case "list_files": {
					const alias = params.alias?.trim().toLowerCase();
					if (!alias) return textContent("Error: alias is required for list_files.");
					return jsonContent(await store.listWorkspaceFiles(alias, params.limit ?? 80));
				}

				case "read_file": {
					const alias = params.alias?.trim().toLowerCase();
					const path = params.path?.trim();
					if (!alias) return textContent("Error: alias is required for read_file.");
					if (!path) return textContent("Error: path is required for read_file.");
					return jsonContent(await store.readWorkspaceFile(alias, path, params.maxChars ?? 16000));
				}

				default:
					return textContent(`Unknown piwork_resources action: ${params.action}`);
			}
		} catch (error) {
			return textContent(`Error: ${toErrorMessage(error)}`);
		}
	},
};

export const createPiworkArtifactsTool = (
	chatId: string,
	options?: {
		onArtifactWrite?: (artifactId: string, action: ArtifactWriteAction) => void;
	},
): CustomTool<typeof PiworkArtifactsParams> => ({
	name: "piwork_artifacts",
	label: "piwork Artifacts",
	description:
		"Create, update, list, and read generated files stored in piwork's managed home folder.",
	parameters: PiworkArtifactsParams,

	async execute(_toolCallId, params: PiworkArtifactsInput) {
		try {
			switch (params.action) {
				case "list":
					return jsonContent(
						await store.listArtifacts({
							chatId: params.chatId?.trim() || undefined,
							kind: params.kind,
							tags: params.tags,
						}),
					);

				case "create": {
					const title = params.title?.trim();
					if (!title) return textContent("Error: title is required for create.");
					if (params.content == null) return textContent("Error: content is required for create.");
					const artifact = await store.createArtifact({
						chatId,
						title,
						content: params.content,
						fileName: params.fileName,
						kind: params.kind,
						tags: params.tags,
					});
					options?.onArtifactWrite?.(artifact.id, "create");
					return jsonContent(artifact);
				}

				case "update": {
					const artifactId = params.artifactId?.trim();
					if (!artifactId) return textContent("Error: artifactId is required for update.");
					if (params.content == null && !params.title && !params.tags?.length) {
						return textContent("Error: content, title, or tags is required for update.");
					}
					const artifact = await store.updateArtifact({
						artifactId,
						title: params.title,
						content: params.content,
						tags: params.tags,
					});
					options?.onArtifactWrite?.(artifact.id, "update");
					return jsonContent(artifact);
				}

				case "read": {
					const artifactId = params.artifactId?.trim();
					if (!artifactId) return textContent("Error: artifactId is required for read.");
					return jsonContent(await store.getArtifact(artifactId));
				}

				case "import_file": {
					const sourcePath = params.sourcePath?.trim();
					if (!sourcePath) return textContent("Error: sourcePath is required for import_file.");
					const artifact = await store.importArtifactFile({
						chatId,
						sourcePath,
						title: params.title?.trim() || undefined,
						tags: params.tags,
						kind: params.kind,
					});
					options?.onArtifactWrite?.(artifact.id, "create");
					return jsonContent(artifact);
				}

				default:
					return textContent(`Unknown piwork_artifacts action: ${params.action}`);
			}
		} catch (error) {
			return textContent(`Error: ${toErrorMessage(error)}`);
		}
	},
});

export const piworkHomeTool: CustomTool<typeof PiworkHomeParams> = {
	name: "piwork_home",
	label: "piwork Home",
	description:
		"Read and update piwork's quick-access files: memory.md, toc.md, links.csv, and daily notes in piwork's managed home folder.",
	parameters: PiworkHomeParams,

	async execute(_toolCallId, params: PiworkHomeInput) {
		try {
			switch (params.action) {
				case "read_memory":
					return textContent(await homeFiles.readMemory());

				case "remember_fact": {
					const fact = params.fact?.trim();
					const section = params.section?.trim() as "User" | "Preferences" | "Projects" | "Open Loops" | undefined;
					if (!fact) return textContent("Error: fact is required for remember_fact.");
					return textContent(await homeFiles.rememberFact(section ?? "User", fact));
				}

				case "read_toc":
					return textContent(await homeFiles.readToc());

				case "upsert_toc_entry": {
					const label = params.label?.trim();
					const target = params.target?.trim();
					if (!label) return textContent("Error: label is required for upsert_toc_entry.");
					if (!target) return textContent("Error: target is required for upsert_toc_entry.");
					return textContent(await homeFiles.upsertTocEntry({
						section: params.section,
						label,
						target,
						description: params.description,
					}));
				}

				case "read_links":
					return jsonContent(await homeFiles.readLinks());

				case "upsert_link": {
					const url = params.url?.trim();
					if (!url) return textContent("Error: url is required for upsert_link.");
					return jsonContent(await homeFiles.upsertLink({
						url,
						title: params.title,
						summary: params.summary,
						tags: params.tags,
						chatId: params.chatId,
					}));
				}

				case "read_daily":
					return jsonContent(await homeFiles.readDaily(params.date?.trim()));

				case "append_daily": {
					const content = params.content?.trim();
					if (!content) return textContent("Error: content is required for append_daily.");
					return jsonContent(await homeFiles.appendDaily({
						date: params.date?.trim(),
						section: params.section?.trim(),
						content,
					}));
				}

				default:
					return textContent(`Unknown piwork_home action: ${params.action}`);
			}
		} catch (error) {
			return textContent(`Error: ${toErrorMessage(error)}`);
		}
	},
};
