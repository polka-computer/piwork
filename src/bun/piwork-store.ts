import { access, appendFile, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { basename, extname, join, relative, resolve, sep } from "node:path";
import {
	type ArtifactFilterParams,
	type ArtifactDetail,
	type ArtifactKind,
	type ArtifactSummary,
	type ChatMessage,
	type ChatStatus,
	type ChatSummary,
	type ChatThread,
	type DashboardState,
	type WorkspaceSummary,
} from "../shared/view-rpc";
import {
	PIWORK_CHATS_DIR,
	PIWORK_CONFIG_FILE,
	PIWORK_OBJECTS_DIR,
	PIWORK_SESSIONS_DIR,
} from "./piwork-paths";
import { ulid } from "../shared/ulid";
import { getPiworkHomeFilePaths, type PiworkHomeFilePaths } from "./home-files";
import {
	initArtifactIndex,
	listArtifactTagsFromIndex,
	queryArtifactsFromIndex,
	removeArtifactFromIndex,
	replaceArtifactIndex,
	upsertArtifactIndex,
} from "./artifact-indexer";

interface PiworkSettings {
	workspaces: WorkspaceSummary[];
	selectedModelId?: string;
	semanticSearchEnabled?: boolean;
	homeFiles: PiworkHomeFilePaths;
}

interface SessionRecord {
	key: string;
	rotatedAt: string;
}

interface ChatMeta {
	id: string;
	title: string;
	createdAt: string;
	updatedAt: string;
	lastMessagePreview: string;
	messageCount: number;
	workspaceMentions: string[];
	artifactIds: string[];
	archivedAt?: string | null;
	reviewedAt?: string | null;
}

interface ArtifactMeta extends ArtifactSummary {}

const DEFAULT_CHAT_TITLE = "New thread";
const ARCHIVE_AFTER_MS = 1000 * 60 * 60 * 24 * 14;
const TEXT_EXTENSIONS = new Set([
	".md",
	".mdx",
	".txt",
	".csv",
	".json",
	".yaml",
	".yml",
	".toml",
	".xml",
	".ts",
	".tsx",
	".js",
	".jsx",
	".css",
	".html",
	".sql",
	".py",
	".rb",
	".go",
	".rs",
	".java",
	".swift",
	".kt",
	".sh",
]);
const EXCLUDED_SEGMENTS = new Set([
	".git",
	".cache",
	".next",
	"build",
	"coverage",
	"dist",
	"node_modules",
	"vendor",
]);
const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"]);
const IMAGE_MIME_TYPES: Record<string, string> = {
	".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
	".gif": "image/gif", ".webp": "image/webp", ".svg": "image/svg+xml",
};
const VIDEO_EXTENSIONS = new Set([".mp4", ".webm", ".mov"]);
const VIDEO_MIME_TYPES: Record<string, string> = {
	".mp4": "video/mp4", ".webm": "video/webm", ".mov": "video/quicktime",
};
const MAX_WORKSPACE_FILE_CHARS = 16_000;

const chatDir = (id: string): string => join(PIWORK_CHATS_DIR, id);
const chatMetaFile = (id: string): string => join(chatDir(id), "chat.json");
const chatMessagesFile = (id: string): string => join(chatDir(id), "messages.jsonl");
// A chat is the user-facing thread. A session key is the agent runtime continuation
// state for that chat, stored separately under the piwork home folder's sessions/<chatId>/<sessionKey>.
const chatSessionFile = (id: string): string => join(chatDir(id), "session.json");
const artifactDir = (id: string): string => join(PIWORK_OBJECTS_DIR, id);
const artifactMetaFile = (id: string): string => join(artifactDir(id), "meta.json");

const preview = (text: string, max = 100): string => {
	const collapsed = text.replace(/\s+/g, " ").trim();
	return collapsed.length <= max ? collapsed : `${collapsed.slice(0, max - 1)}…`;
};

const sanitizeAlias = (value: string): string =>
	value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9_-]+/g, "-")
		.replace(/^-+|-+$/g, "")
		|| "workspace";

const deriveTitle = (text: string): string => {
	const stripped = text.replace(/@[a-z0-9_-]+\b/gi, "").trim();
	if (!stripped) return DEFAULT_CHAT_TITLE;
	const firstLine = stripped.split("\n")[0]?.trim() ?? DEFAULT_CHAT_TITLE;
	return firstLine.length <= 56 ? firstLine : `${firstLine.slice(0, 55)}…`;
};

const safeFileName = (input: string, fallbackExt: string): string => {
	const normalized = input
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9._-]+/g, "-")
		.replace(/^-+|-+$/g, "");
	const base = normalized || `artifact${fallbackExt}`;
	return extname(base) ? base : `${base}${fallbackExt}`;
};

const isWithin = (root: string, target: string): boolean =>
	target === root || target.startsWith(`${root}${sep}`);

const workspaceExtAllowed = (relativePath: string): boolean =>
	TEXT_EXTENSIONS.has(extname(relativePath).toLowerCase());

const shouldSkipRelativePath = (relativePath: string): boolean =>
	relativePath.split("/").some((segment) => {
		if (!segment) return false;
		if (segment.startsWith(".")) return true;
		return EXCLUDED_SEGMENTS.has(segment);
	});

const normalizeRelativePath = (value: string): string =>
	value.replace(/\\/g, "/").replace(/^\.\//, "");

const createSessionKey = (): string => ulid();

const readJson = async <T>(filePath: string, fallback: T): Promise<T> => {
	try {
		const raw = await readFile(filePath, "utf-8");
		return JSON.parse(raw) as T;
	} catch {
		return fallback;
	}
};

const writeJson = async (filePath: string, value: unknown): Promise<void> => {
	await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf-8");
};

const readJsonl = async <T>(filePath: string): Promise<T[]> => {
	try {
		const raw = await readFile(filePath, "utf-8");
		return raw
			.trim()
			.split("\n")
			.filter(Boolean)
			.map((line) => JSON.parse(line) as T);
	} catch {
		return [];
	}
};

const pathExists = async (path: string): Promise<boolean> => {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
};

const defaultSettings = (): PiworkSettings => ({
	workspaces: [],
	homeFiles: getPiworkHomeFilePaths(),
});

const readSettings = async (): Promise<PiworkSettings> => {
	const settings = await readJson<PiworkSettings>(PIWORK_CONFIG_FILE, defaultSettings());
	return {
		...defaultSettings(),
		...settings,
		homeFiles: {
			...getPiworkHomeFilePaths(),
			...(settings.homeFiles ?? {}),
		},
		workspaces: settings.workspaces ?? [],
	};
};

const writeSettings = async (settings: PiworkSettings): Promise<void> => {
	await writeJson(PIWORK_CONFIG_FILE, settings);
};

const readChatMeta = async (id: string): Promise<ChatMeta> => {
	const meta = await readJson<ChatMeta | null>(chatMetaFile(id), null);
	if (!meta) throw new Error(`Chat not found: ${id}`);
	return meta;
};

const writeChatMeta = async (id: string, meta: ChatMeta): Promise<void> => {
	await writeJson(chatMetaFile(id), meta);
};

const inferChatStatus = (
	meta: Pick<ChatMeta, "updatedAt" | "messageCount" | "archivedAt" | "reviewedAt">,
	messages: ChatMessage[],
): ChatStatus => {
	if (meta.archivedAt) return "archived";
	if (meta.messageCount > 0 && Date.now() - new Date(meta.updatedAt).getTime() > ARCHIVE_AFTER_MS) {
		return "archived";
	}

	const lastMessage = messages[messages.length - 1];
	if (!lastMessage) return "running";
	if (lastMessage.role === "user") return "running";
	if (lastMessage.meta?.errorMessage) return "needs_review";
	if (lastMessage.artifactIds.length > 0) {
		const reviewedAt = meta.reviewedAt ? new Date(meta.reviewedAt).getTime() : 0;
		const updatedAt = new Date(meta.updatedAt).getTime();
		return reviewedAt >= updatedAt ? "completed" : "needs_review";
	}
	return "completed";
};

const toChatSummary = (meta: ChatMeta, messages: ChatMessage[]): ChatSummary => ({
	id: meta.id,
	title: meta.title,
	status: inferChatStatus(meta, messages),
	createdAt: meta.createdAt,
	updatedAt: meta.updatedAt,
	lastMessagePreview: meta.lastMessagePreview,
	messageCount: meta.messageCount,
	workspaceMentions: meta.workspaceMentions,
});

const readSessionKey = async (path: string): Promise<string | null> => {
	const record = await readJson<SessionRecord | null>(path, null);
	return record?.key?.trim() || null;
};

const writeSessionKey = async (path: string, key: string): Promise<void> => {
	await writeJson(path, {
		key,
		rotatedAt: new Date().toISOString(),
	} satisfies SessionRecord);
};

const inferArtifactKind = (fileName: string, requestedKind?: ArtifactKind): ArtifactKind => {
	if (requestedKind) return requestedKind;
	const extension = extname(fileName).toLowerCase();
	if (extension === ".md" || extension === ".mdx") return "markdown";
	if (extension === ".csv") return "csv";
	if (extension === ".json") return "json";
	if (extension === ".txt") return "text";
	if (IMAGE_EXTENSIONS.has(extension)) return "image";
	if (VIDEO_EXTENSIONS.has(extension)) return "video";
	return "other";
};

const artifactExtension = (kind: ArtifactKind): string => {
	switch (kind) {
		case "markdown":
			return ".md";
		case "csv":
			return ".csv";
		case "json":
			return ".json";
		case "text":
			return ".txt";
		case "image":
			return ".png";
		default:
			return ".txt";
	}
};

const normalizeTags = (tags: string[] | undefined): string[] =>
	Array.from(
		new Set(
			(tags ?? [])
				.map((tag) => tag.trim().toLowerCase())
				.filter(Boolean),
		),
	).sort((left, right) => left.localeCompare(right));

const toArtifactMeta = (value: ArtifactSummary | (Partial<ArtifactMeta> & { id: string; title: string; kind: ArtifactKind; fileName: string; path: string; createdAt: string; updatedAt: string; excerpt: string })): ArtifactMeta => ({
	id: value.id,
	chatId: value.chatId ?? value.createdByChatId ?? "",
	createdByChatId: value.createdByChatId ?? value.chatId ?? "",
	createdByMessageId: value.createdByMessageId,
	title: value.title,
	kind: value.kind,
	fileName: value.fileName,
	path: value.path,
	createdAt: value.createdAt,
	updatedAt: value.updatedAt,
	excerpt: value.excerpt,
	tags: normalizeTags(value.tags),
});

const readArtifactSummary = async (id: string): Promise<ArtifactSummary | null> => {
	const summary = await readJson<ArtifactMeta | null>(artifactMetaFile(id), null);
	if (!summary) return null;
	return toArtifactMeta(summary);
};

const listArtifactIds = async (): Promise<string[]> => {
	try {
		const entries = await readdir(PIWORK_OBJECTS_DIR, { withFileTypes: true });
		return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
	} catch {
		return [];
	}
};

const listChatIds = async (): Promise<string[]> => {
	try {
		const entries = await readdir(PIWORK_CHATS_DIR, { withFileTypes: true });
		return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
	} catch {
		return [];
	}
};

export const listWorkspaces = async (): Promise<WorkspaceSummary[]> => {
	const settings = await readSettings();
	return [...settings.workspaces].sort((left, right) => left.alias.localeCompare(right.alias));
};

export const countWorkspaceFiles = async (workspacePath: string): Promise<number> => {
	let count = 0;
	const glob = new Bun.Glob("**/*");
	for await (const entry of glob.scan({
		cwd: workspacePath,
		onlyFiles: true,
		followSymlinks: false,
	})) {
		const relativePath = normalizeRelativePath(entry);
		if (shouldSkipRelativePath(relativePath)) continue;
		if (!workspaceExtAllowed(relativePath)) continue;
		count += 1;
	}
	return count;
};

export const addWorkspace = async (inputPath: string, alias?: string): Promise<WorkspaceSummary> => {
	const resolvedPath = resolve(inputPath.trim());
	if (!resolvedPath) throw new Error("Workspace path is required.");

	const settings = await readSettings();
	if (settings.workspaces.some((workspace) => workspace.path === resolvedPath)) {
		throw new Error("That folder is already indexed.");
	}

	const existingAliases = new Set(settings.workspaces.map((workspace) => workspace.alias));
	const requestedAlias = sanitizeAlias(alias?.trim() || basename(resolvedPath));
	let nextAlias = requestedAlias;
	let suffix = 2;
	while (existingAliases.has(nextAlias)) {
		nextAlias = `${requestedAlias}-${suffix}`;
		suffix += 1;
	}

	const workspace: WorkspaceSummary = {
		id: ulid(),
		alias: nextAlias,
		path: resolvedPath,
		fileCount: await countWorkspaceFiles(resolvedPath),
		indexedAt: new Date().toISOString(),
	};

	settings.workspaces.push(workspace);
	await writeSettings(settings);
	return workspace;
};

export const renameWorkspace = async (workspaceId: string, alias: string): Promise<void> => {
	const settings = await readSettings();
	const nextAlias = sanitizeAlias(alias);
	const target = settings.workspaces.find((workspace) => workspace.id === workspaceId);
	if (!target) throw new Error(`Workspace not found: ${workspaceId}`);
	if (
		settings.workspaces.some(
			(workspace) => workspace.id !== workspaceId && workspace.alias === nextAlias,
		)
	) {
		throw new Error(`@${nextAlias} is already in use.`);
	}

	target.alias = nextAlias;
	await writeSettings(settings);
};

export const removeWorkspace = async (workspaceId: string): Promise<void> => {
	const settings = await readSettings();
	settings.workspaces = settings.workspaces.filter((workspace) => workspace.id !== workspaceId);
	await writeSettings(settings);
};

export const listWorkspaceFiles = async (
	alias: string,
	limit = 80,
): Promise<{ alias: string; path: string; count: number; files: string[] }> => {
	const workspace = (await listWorkspaces()).find((item) => item.alias === alias);
	if (!workspace) throw new Error(`Unknown workspace: @${alias}`);

	const files: string[] = [];
	let total = 0;
	const glob = new Bun.Glob("**/*");
	for await (const entry of glob.scan({
		cwd: workspace.path,
		onlyFiles: true,
		followSymlinks: false,
	})) {
		const relativePath = normalizeRelativePath(entry);
		if (shouldSkipRelativePath(relativePath)) continue;
		if (!workspaceExtAllowed(relativePath)) continue;
		total += 1;
		if (files.length < limit) files.push(relativePath);
	}

	files.sort((left, right) => left.localeCompare(right));
	return { alias, path: workspace.path, count: total, files };
};

export const readWorkspaceFile = async (
	alias: string,
	requestedPath: string,
	maxChars = MAX_WORKSPACE_FILE_CHARS,
): Promise<{ alias: string; path: string; content: string; truncated: boolean }> => {
	const workspace = (await listWorkspaces()).find((item) => item.alias === alias);
	if (!workspace) throw new Error(`Unknown workspace: @${alias}`);

	const root = resolve(workspace.path);
	const target = resolve(root, requestedPath);
	if (!isWithin(root, target)) {
		throw new Error("Workspace file must stay within the indexed folder.");
	}

	const relativePath = normalizeRelativePath(relative(root, target));
	if (shouldSkipRelativePath(relativePath) || !workspaceExtAllowed(relativePath)) {
		throw new Error("That file is not available as indexed text content.");
	}

	const content = await Bun.file(target).text();
	return {
		alias,
		path: relativePath,
		content: content.slice(0, maxChars),
		truncated: content.length > maxChars,
	};
};

export const listChats = async (): Promise<ChatSummary[]> => {
	const ids = await listChatIds();
	const chats = await Promise.all(
		ids.map(async (id) => {
			try {
				const meta = await readChatMeta(id);
				const messages = await readJsonl<ChatMessage>(chatMessagesFile(id));
				return toChatSummary(meta, messages);
			} catch {
				return null;
			}
		}),
	);

	return chats
		.filter((chat): chat is ChatSummary => chat !== null)
		.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
};

export const createChat = async (title?: string): Promise<ChatThread> => {
	const id = ulid();
	const now = new Date().toISOString();
	const meta: ChatMeta = {
		id,
		title: title?.trim() || DEFAULT_CHAT_TITLE,
		createdAt: now,
		updatedAt: now,
		lastMessagePreview: "",
		messageCount: 0,
		workspaceMentions: [],
		artifactIds: [],
		archivedAt: null,
		reviewedAt: null,
	};

	await mkdir(chatDir(id), { recursive: true });
	await writeChatMeta(id, meta);
	await writeFile(chatMessagesFile(id), "", "utf-8");
	await writeSessionKey(chatSessionFile(id), createSessionKey());

	return {
		...toChatSummary(meta, []),
		messages: [],
		artifacts: [],
	};
};

export const getChatSessionKey = async (chatId: string): Promise<string> => {
	const existing = await readSessionKey(chatSessionFile(chatId));
	if (existing) return existing;
	const key = createSessionKey();
	await writeSessionKey(chatSessionFile(chatId), key);
	return key;
};

export const appendChatMessage = async (chatId: string, message: ChatMessage): Promise<void> => {
	const meta = await readChatMeta(chatId);
	await appendFile(chatMessagesFile(chatId), `${JSON.stringify(message)}\n`);

	const nextWorkspaceMentions = Array.from(
		new Set([...meta.workspaceMentions, ...message.workspaceMentions]),
	).sort();
	const nextTitle = meta.messageCount === 0 && message.role === "user" && meta.title === DEFAULT_CHAT_TITLE
		? deriveTitle(message.content)
		: meta.title;

	await writeChatMeta(chatId, {
		...meta,
		title: nextTitle,
		updatedAt: message.createdAt,
		lastMessagePreview: preview(message.content),
		messageCount: meta.messageCount + 1,
		workspaceMentions: nextWorkspaceMentions,
		archivedAt: null,
		reviewedAt: message.role === "assistant" && !message.meta?.errorMessage && message.artifactIds.length === 0
			? message.createdAt
			: null,
	});
};

export const markChatReviewed = async (chatId: string): Promise<void> => {
	const meta = await readChatMeta(chatId);
	await writeChatMeta(chatId, {
		...meta,
		reviewedAt: new Date().toISOString(),
	});
};

export const setSelectedModel = async (modelId?: string): Promise<void> => {
	const settings = await readSettings();
	await writeSettings({
		...settings,
		selectedModelId: modelId?.trim() || undefined,
	});
};

export const getSelectedModel = async (): Promise<string | undefined> => {
	const settings = await readSettings();
	return settings.selectedModelId?.trim() || undefined;
};

export const setSemanticSearchEnabled = async (enabled: boolean): Promise<void> => {
	const settings = await readSettings();
	await writeSettings({
		...settings,
		semanticSearchEnabled: enabled,
	});
};

export const getSemanticSearchEnabled = async (): Promise<boolean> => {
	const settings = await readSettings();
	return settings.semanticSearchEnabled === true;
};

export const archiveChat = async (chatId: string, archived: boolean): Promise<void> => {
	const meta = await readChatMeta(chatId);
	await writeChatMeta(chatId, {
		...meta,
		archivedAt: archived ? new Date().toISOString() : null,
	});
};

export const deleteChat = async (chatId: string): Promise<void> => {
	const createdArtifacts = await listArtifacts({ chatId });
	for (const artifact of createdArtifacts) removeArtifactFromIndex(artifact.id);
	await Promise.all([
		rm(chatDir(chatId), { recursive: true, force: true }),
		rm(join(PIWORK_SESSIONS_DIR, chatId), { recursive: true, force: true }),
		...createdArtifacts.map((artifact) => rm(artifactDir(artifact.id), { recursive: true, force: true })),
	]);
};

export const deleteArtifact = async (artifactId: string): Promise<void> => {
	removeArtifactFromIndex(artifactId);
	await rm(artifactDir(artifactId), { recursive: true, force: true });
};

export const initializeArtifactStore = async (): Promise<void> => {
	initArtifactIndex();
	const artifactIds = await listArtifactIds();
	const artifacts = await Promise.all(
		artifactIds.map(async (id) => {
			const artifact = await readArtifactSummary(id);
			if (!artifact) return null;
			return (await pathExists(artifact.path)) ? artifact : null;
		}),
	);
	replaceArtifactIndex(artifacts.filter((artifact): artifact is ArtifactSummary => artifact !== null));
};

export const listArtifacts = async (filters?: ArtifactFilterParams): Promise<ArtifactSummary[]> =>
	queryArtifactsFromIndex(filters);

export const listArtifactsForChat = async (chatId: string): Promise<ArtifactSummary[]> => {
	const meta = await readChatMeta(chatId);
	const artifacts = await listArtifactsByIds(meta.artifactIds);
	return [...artifacts].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
};

export const listArtifactTags = async (): Promise<string[]> => listArtifactTagsFromIndex();

export const listArtifactsByIds = async (artifactIds: string[]): Promise<ArtifactSummary[]> => {
	const ids = Array.from(new Set(artifactIds.map((id) => id.trim()).filter(Boolean)));
	const artifacts = await Promise.all(ids.map((id) => readArtifactSummary(id)));
	return artifacts.filter((artifact): artifact is ArtifactSummary => artifact !== null);
};

export const associateArtifactsWithChat = async (params: {
	chatId: string;
	artifactIds: string[];
}): Promise<void> => {
	const artifactIds = Array.from(new Set(params.artifactIds.map((id) => id.trim()).filter(Boolean)));
	if (artifactIds.length === 0) return;

	const existingArtifacts = await listArtifactsByIds(artifactIds);
	if (existingArtifacts.length === 0) return;

	const meta = await readChatMeta(params.chatId);
	await writeChatMeta(params.chatId, {
		...meta,
		artifactIds: Array.from(
			new Set([...meta.artifactIds, ...existingArtifacts.map((artifact) => artifact.id)]),
		),
	});
};

export const buildArtifactPromptContext = async (artifactIds: string[]): Promise<string> => {
	const artifacts = await listArtifactsByIds(artifactIds);
	if (artifacts.length === 0) return "No piwork artifacts were referenced in this turn.";

	return artifacts
		.map((artifact) =>
			[
				`${artifact.id}: ${artifact.title}`,
				`kind: ${artifact.kind}`,
				`file: ${artifact.fileName}`,
				`tags: ${artifact.tags.length > 0 ? artifact.tags.join(", ") : "none"}`,
				`excerpt: ${artifact.excerpt || "none"}`,
			].join("\n"),
		)
		.join("\n\n");
};

export const syncArtifactFromDisk = async (artifactId: string): Promise<void> => {
	const summary = await readArtifactSummary(artifactId);
	if (!summary) {
		removeArtifactFromIndex(artifactId);
		return;
	}

	const fileExists = await pathExists(summary.path);
	if (!fileExists) {
		removeArtifactFromIndex(artifactId);
		return;
	}

	const isImage = summary.kind === "image" || IMAGE_EXTENSIONS.has(extname(summary.fileName).toLowerCase());
	const isVideo = summary.kind === "video" || VIDEO_EXTENSIONS.has(extname(summary.fileName).toLowerCase());
	const isMedia = isImage || isVideo;
	const content = isMedia ? "" : await readFile(summary.path, "utf-8");
	const fileStats = await stat(summary.path);
	const excerpt = isMedia ? `${isVideo ? "Video" : "Image"}: ${summary.fileName}` : preview(content, 180);
	const recalculated = toArtifactMeta({
		...summary,
		updatedAt: fileStats.mtime.toISOString() > summary.updatedAt ? fileStats.mtime.toISOString() : summary.updatedAt,
		excerpt,
	});

	if (
		recalculated.updatedAt !== summary.updatedAt ||
		recalculated.excerpt !== summary.excerpt ||
		recalculated.createdByChatId !== summary.createdByChatId ||
		recalculated.chatId !== summary.chatId ||
		JSON.stringify(recalculated.tags) !== JSON.stringify(summary.tags)
	) {
		await writeJson(artifactMetaFile(artifactId), recalculated);
	}

	upsertArtifactIndex(recalculated);
};

export const createArtifact = async (params: {
	chatId: string;
	title: string;
	content: string;
	fileName?: string;
	kind?: ArtifactKind;
	tags?: string[];
	createdByMessageId?: string;
}): Promise<ArtifactSummary> => {
	const id = ulid();
	const now = new Date().toISOString();
	const kind = params.kind ?? "markdown";
	const fileName = safeFileName(params.fileName ?? params.title, artifactExtension(kind));
	const directory = artifactDir(id);
	const filePath = join(directory, fileName);
	const artifact = toArtifactMeta({
		id,
		chatId: params.chatId,
		createdByChatId: params.chatId,
		createdByMessageId: params.createdByMessageId,
		title: params.title.trim() || "Untitled artifact",
		kind: inferArtifactKind(fileName, kind),
		fileName,
		path: filePath,
		createdAt: now,
		updatedAt: now,
		excerpt: preview(params.content, 180),
		tags: params.tags ?? [],
	});

	await mkdir(directory, { recursive: true });
	await writeFile(filePath, params.content, "utf-8");
	await writeJson(artifactMetaFile(id), artifact);
	upsertArtifactIndex(artifact);

	const meta = await readChatMeta(params.chatId);
	await writeChatMeta(params.chatId, {
		...meta,
		updatedAt: now,
		artifactIds: Array.from(new Set([...meta.artifactIds, id])),
	});

	return artifact;
};

export const updateArtifact = async (params: {
	artifactId: string;
	title?: string;
	content?: string;
	tags?: string[];
}): Promise<ArtifactSummary> => {
	const existing = await readArtifactSummary(params.artifactId);
	if (!existing) throw new Error(`Artifact not found: ${params.artifactId}`);

	const isMedia = existing.kind === "image" || existing.kind === "video";
	const nextContent = isMedia ? "" : (params.content ?? await readFile(existing.path, "utf-8"));
	const excerpt = isMedia ? `${existing.kind === "video" ? "Video" : "Image"}: ${existing.fileName}` : preview(nextContent, 180);
	const updated = toArtifactMeta({
		...existing,
		title: params.title?.trim() || existing.title,
		updatedAt: new Date().toISOString(),
		excerpt,
		tags: params.tags ? normalizeTags(params.tags) : existing.tags,
	});

	if (params.content != null && !isMedia) {
		await writeFile(existing.path, params.content, "utf-8");
	}
	await writeJson(artifactMetaFile(existing.id), updated);
	upsertArtifactIndex(updated);
	return updated;
};

export const finalizeCreatedArtifactsForMessage = async (params: {
	chatId: string;
	messageId: string;
	artifactIds: string[];
}): Promise<void> => {
	const artifactIds = Array.from(new Set(params.artifactIds.filter(Boolean)));
	if (artifactIds.length === 0) return;

	for (const artifactId of artifactIds) {
		const existing = await readArtifactSummary(artifactId);
		if (!existing) continue;
		if (existing.createdByChatId !== params.chatId) continue;
		if (existing.createdByMessageId) continue;
		const updated = toArtifactMeta({
			...existing,
			createdByMessageId: params.messageId,
		});
		await writeJson(artifactMetaFile(artifactId), updated);
		upsertArtifactIndex(updated);
	}
};

export const importArtifactFile = async (params: {
	chatId: string;
	sourcePath: string;
	title?: string;
	tags?: string[];
	kind?: ArtifactKind;
}): Promise<ArtifactSummary> => {
	const source = Bun.file(params.sourcePath);
	if (!(await source.exists())) throw new Error(`Source file not found: ${params.sourcePath}`);

	const id = ulid();
	const now = new Date().toISOString();
	const sourceFileName = basename(params.sourcePath);
	const kind = inferArtifactKind(sourceFileName, params.kind);
	const fileName = safeFileName(sourceFileName, artifactExtension(kind));
	const directory = artifactDir(id);
	const filePath = join(directory, fileName);
	const isImage = kind === "image" || IMAGE_EXTENSIONS.has(extname(sourceFileName).toLowerCase());
	const isVideo = kind === "video" || VIDEO_EXTENSIONS.has(extname(sourceFileName).toLowerCase());
	const isMedia = isImage || isVideo;
	const excerpt = isMedia ? `${isVideo ? "Video" : "Image"}: ${fileName}` : preview(await source.text(), 180);

	const artifact = toArtifactMeta({
		id,
		chatId: params.chatId,
		createdByChatId: params.chatId,
		title: params.title?.trim() || sourceFileName,
		kind,
		fileName,
		path: filePath,
		createdAt: now,
		updatedAt: now,
		excerpt,
		tags: params.tags ?? [],
	});

	await mkdir(directory, { recursive: true });
	await Bun.write(filePath, await source.arrayBuffer());
	await writeJson(artifactMetaFile(id), artifact);
	upsertArtifactIndex(artifact);

	const meta = await readChatMeta(params.chatId);
	await writeChatMeta(params.chatId, {
		...meta,
		updatedAt: now,
		artifactIds: Array.from(new Set([...meta.artifactIds, id])),
	});

	return artifact;
};

const toDataUrl = async (filePath: string, mimeType: string): Promise<string> => {
	const buffer = await readFile(filePath);
	return `data:${mimeType};base64,${Buffer.from(buffer).toString("base64")}`;
};

export const getArtifact = async (artifactId: string): Promise<ArtifactDetail> => {
	const summary = await readArtifactSummary(artifactId);
	if (!summary) throw new Error(`Artifact not found: ${artifactId}`);
	if (summary.kind === "image") {
		const ext = extname(summary.fileName).toLowerCase();
		const mimeType = IMAGE_MIME_TYPES[ext] ?? "image/png";
		return { ...summary, kind: "image", previewUrl: await toDataUrl(summary.path, mimeType), mimeType } as ArtifactDetail;
	}
	if (summary.kind === "video") {
		const ext = extname(summary.fileName).toLowerCase();
		const mimeType = VIDEO_MIME_TYPES[ext] ?? "video/mp4";
		return { ...summary, kind: "video", previewUrl: await toDataUrl(summary.path, mimeType), mimeType } as ArtifactDetail;
	}
	const content = await readFile(summary.path, "utf-8");
	return { ...summary, content } as ArtifactDetail;
};

export const getChat = async (id: string): Promise<ChatThread> => {
	const meta = await readChatMeta(id);
	const messages = await readJsonl<ChatMessage>(chatMessagesFile(id));
	const artifacts = await listArtifactsForChat(id);
	return {
		...toChatSummary(meta, messages),
		messages,
		artifacts,
	};
};

export const getLatestUserMessage = async (chatId: string): Promise<ChatMessage | null> => {
	const messages = await readJsonl<ChatMessage>(chatMessagesFile(chatId));
	for (let index = messages.length - 1; index >= 0; index -= 1) {
		const message = messages[index];
		if (message?.role === "user") return message;
	}
	return null;
};

const generateThumbnailDataUrl = async (filePath: string, mimeType: string): Promise<string | undefined> => {
	try {
		const buffer = await readFile(filePath);
		return `data:${mimeType};base64,${Buffer.from(buffer).toString("base64")}`;
	} catch {
		return undefined;
	}
};

const enrichWithThumbnails = async (artifacts: ArtifactSummary[]): Promise<ArtifactSummary[]> =>
	Promise.all(artifacts.map(async (a) => {
		if (a.kind !== "image") return a;
		const ext = extname(a.fileName).toLowerCase();
		const mime = IMAGE_MIME_TYPES[ext] ?? "image/png";
		const thumbnailUrl = await generateThumbnailDataUrl(a.path, mime);
		return thumbnailUrl ? { ...a, thumbnailUrl } : a;
	}));

export const getDashboardState = async (): Promise<DashboardState> => ({
	chats: await listChats(),
	workspaces: await listWorkspaces(),
	artifacts: await enrichWithThumbnails(await listArtifacts()),
	artifactTags: await listArtifactTags(),
	selectedModelId: await getSelectedModel(),
});

export const getMentionedWorkspaceAliases = async (text: string): Promise<string[]> => {
	const available = new Set((await listWorkspaces()).map((workspace) => workspace.alias));
	const aliases = new Set<string>();
	for (const match of text.matchAll(/@([a-z0-9_-]+)/gi)) {
		const alias = (match[1] ?? "").toLowerCase();
		if (available.has(alias)) aliases.add(alias);
	}
	return Array.from(aliases);
};

export const buildWorkspacePromptContext = async (aliases: string[]): Promise<string> => {
	if (aliases.length === 0) return "No indexed workspaces were referenced in this turn.";

	const sections = await Promise.all(
		aliases.map(async (alias) => {
			const listing = await listWorkspaceFiles(alias, 24);
			return [
				`@${alias} → ${listing.path}`,
				`Indexed files: ${listing.count}`,
				listing.files.length > 0 ? `Sample files:\n${listing.files.map((file) => `- ${file}`).join("\n")}` : "Sample files: none",
			].join("\n");
		}),
	);

	return sections.join("\n\n");
};
