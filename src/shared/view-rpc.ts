export type ChatMessageRole = "user" | "assistant" | "system";
export type ArtifactKind = "markdown" | "csv" | "json" | "text" | "image" | "video" | "other";
export type ChatStatus = "needs_review" | "running" | "completed" | "archived";

export interface WorkspaceSummary {
	id: string;
	alias: string;
	path: string;
	fileCount: number;
	indexedAt: string;
}

export interface ArtifactSummary {
	id: string;
	chatId: string;
	createdByChatId: string;
	createdByMessageId?: string;
	title: string;
	kind: ArtifactKind;
	fileName: string;
	path: string;
	createdAt: string;
	updatedAt: string;
	excerpt: string;
	tags: string[];
	thumbnailUrl?: string;
}

export type ArtifactDetail =
	| (ArtifactSummary & { kind: Exclude<ArtifactKind, "image" | "video">; content: string })
	| (ArtifactSummary & { kind: "image"; previewUrl: string; mimeType?: string })
	| (ArtifactSummary & { kind: "video"; previewUrl: string; mimeType?: string });

export interface ChatMessage {
	id: string;
	role: ChatMessageRole;
	content: string;
	createdAt: string;
	workspaceMentions: string[];
	artifactIds: string[];
	meta?: {
		selectedModel?: string;
		durationMs?: number;
		errorMessage?: string;
	};
}

export interface ChatSummary {
	id: string;
	title: string;
	status: ChatStatus;
	createdAt: string;
	updatedAt: string;
	lastMessagePreview: string;
	messageCount: number;
	workspaceMentions: string[];
}

export interface ChatThread extends ChatSummary {
	messages: ChatMessage[];
	artifacts: ArtifactSummary[];
}

export interface DashboardState {
	chats: ChatSummary[];
	workspaces: WorkspaceSummary[];
	artifacts: ArtifactSummary[];
	artifactTags: string[];
	selectedModelId?: string;
}

export interface ArtifactFilterParams {
	tags?: string[];
	kind?: ArtifactKind;
	chatId?: string;
}

export interface CreateChatParams {
	title?: string;
}

export interface AvailableModel {
	provider: string;
	id: string;
	name: string;
}

export interface ModelStatus {
	available: boolean;
	models: AvailableModel[];
	error?: string;
	checkedAt: string;
}

export interface ApiKeyProviderStatus {
	provider: string;
	label: string;
	configured: boolean;
	category?: "model" | "research";
}

export interface SearchStatus {
	status: "unconfigured" | "indexing" | "embedding" | "ready" | "error";
	semanticSearchEnabled: boolean;
	collections: number;
	totalDocuments: number;
	hasVectorIndex: boolean;
	needsEmbeddingCount: number;
	lastError?: string;
}


export interface UpdateStatusDetails {
	fromHash?: string;
	toHash?: string;
	currentHash?: string;
	latestHash?: string;
	patchNumber?: number;
	totalPatchesApplied?: number;
	progress?: number;
	bytesDownloaded?: number;
	totalBytes?: number;
	usedPatchPath?: boolean;
	errorMessage?: string;
	url?: string;
	zstdPath?: string;
	exitCode?: number | null;
}

export interface UpdateStatusEntry {
	status: string;
	message: string;
	timestamp: number;
	details?: UpdateStatusDetails;
}

export interface UpdateState {
	version?: string;
	hash?: string;
	updateAvailable: boolean;
	updateReady: boolean;
	error?: string;
	lastStatus?: UpdateStatusEntry;
}

export interface AppInfo {
	name: string;
	version: string;
	channel: string;
	baseUrl: string;
	dataRoot: string;
	platform: "macos" | "win" | "linux";
	arch: "arm64" | "x64";
	selectedModelId?: string;
	modelStatus: ModelStatus;
	search: SearchStatus;
	update: UpdateState;
}

export interface SendChatMessageParams {
	chatId: string;
	content: string;
	modelId?: string;
	attachmentPaths?: string[];
	mentionedArtifactIds?: string[];
}

export interface SendChatMessageResponse {
	chat: ChatThread;
	dashboard: DashboardState;
}

export interface ChatCommandResponse {
	chat: ChatThread;
	dashboard: DashboardState;
}

export interface UpdateArtifactParams {
	artifactId: string;
	title?: string;
	content?: string;
	tags?: string[];
}

export interface UpdateArtifactResponse {
	artifact: ArtifactDetail;
	dashboard: DashboardState;
}

export interface AddWorkspaceParams {
	path: string;
	alias?: string;
}

export interface RenameWorkspaceParams {
	workspaceId: string;
	alias: string;
}

export type OmpErrorCode =
	| "model_resolution_failure"
	| "prompt_timeout"
	| "stream_interruption"
	| "empty_output"
	| "tool_execution_error"
	| "attachment_validation_error"
	| "runtime_error";

export type OmpStreamEvent =
	| { type: "turn_start"; threadId: string }
	| { type: "turn_end"; threadId: string }
	| { type: "error"; threadId: string; message: string; code: OmpErrorCode }
	| { type: "assistant_text_delta"; threadId: string; delta: string }
	| { type: "tool_start"; threadId: string; toolCallId: string; toolName: string }
	| { type: "tool_update"; threadId: string; toolCallId: string; toolName: string; detail?: string }
	| { type: "tool_end"; threadId: string; toolCallId: string; toolName: string; isError?: boolean };

export interface PiworkViewRPCSchema {
	bun: {
		requests: {
			getDashboardState: {
				params: {};
				response: DashboardState;
			};
			getAppInfo: {
				params: {};
				response: AppInfo;
			};
			getChat: {
				params: { id: string };
				response: ChatThread;
			};
			createChat: {
				params: CreateChatParams;
				response: ChatThread;
			};
			sendChatMessage: {
				params: SendChatMessageParams;
				response: SendChatMessageResponse;
			};
			getArtifact: {
				params: { id: string };
				response: ArtifactDetail;
			};
			updateArtifact: {
				params: UpdateArtifactParams;
				response: UpdateArtifactResponse;
			};
			setSelectedModel: {
				params: { modelId?: string };
				response: DashboardState;
			};
			setSemanticSearchEnabled: {
				params: { enabled: boolean };
				response: AppInfo;
			};
			showArtifactInFinder: {
				params: { artifactId: string };
				response: { ok: true };
			};
			openPiworkFolder: {
				params: {};
				response: { ok: true };
			};
			pickWorkspaceFolder: {
				params: {};
				response: { paths: string[] };
			};
			addWorkspace: {
				params: AddWorkspaceParams;
				response: DashboardState;
			};
			renameWorkspace: {
				params: RenameWorkspaceParams;
				response: DashboardState;
			};
			removeWorkspace: {
				params: { workspaceId: string };
				response: DashboardState;
			};
			archiveChat: {
				params: { chatId: string; archived: boolean };
				response: DashboardState;
			};
			markChatReviewed: {
				params: { chatId: string };
				response: DashboardState;
			};
			deleteChat: {
				params: { chatId: string };
				response: DashboardState;
			};
			deleteArtifact: {
				params: { artifactId: string };
				response: DashboardState;
			};
			getAvailableModels: {
				params: {};
				response: { models: AvailableModel[]; error?: string };
			};
			getApiKeyStatus: {
				params: {};
				response: { providers: ApiKeyProviderStatus[] };
			};
			setApiKey: {
				params: { provider: string; apiKey: string };
				response: { providers: ApiKeyProviderStatus[]; modelStatus: ModelStatus };
			};
			removeApiKey: {
				params: { provider: string };
				response: { providers: ApiKeyProviderStatus[]; modelStatus: ModelStatus };
			};
			pickFiles: {
				params: {};
				response: { paths: string[] };
			};
			writeTempFile: {
				params: { name: string; base64: string };
				response: { path: string };
			};
			cancelActiveRun: {
				params: { chatId: string };
				response: ChatCommandResponse;
			};
			retryLastMessage: {
				params: { chatId: string };
				response: ChatCommandResponse;
			};
			checkForUpdate: {
				params: {};
				response: AppInfo;
			};
			downloadUpdate: {
				params: {};
				response: AppInfo;
			};
			applyUpdate: {
				params: {};
				response: { ok: true };
			};
			openExternal: {
				params: { url: string };
				response: { ok: true };
			};
		};
		messages: {};
	};
	webview: {
		requests: {};
		messages: {
			ompEvent: OmpStreamEvent;
			updateStatus: UpdateStatusEntry;
			updateAvailableNotification: { version: string };
		};
	};
}
