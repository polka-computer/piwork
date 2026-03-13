import type { ArtifactKind, ChatMessage, ChatStatus, ChatThread, DashboardState, OmpStreamEvent } from "../shared/view-rpc";

export { CHAT_STATUS_TONES } from "./theme/status";

export type ViewMode = "chat" | "artifacts" | "artifact-detail" | "settings";
export type SidebarSectionKey = "chats" | "drafts" | ChatStatus;

export const CHAT_STATUS_ORDER: ChatStatus[] = ["needs_review", "running", "completed", "archived"];

export const CHAT_STATUS_LABELS: Record<ChatStatus, string> = {
	needs_review: "Needs review",
	running: "Running",
	completed: "Completed",
	archived: "Archived",
};

export const DRAFT_SECTION_LABEL = "Drafts";
export const MAX_ARTIFACT_FILTER_TAGS = 10;
export const MAX_ARTIFACT_CARD_TAGS = 2;

export const DEFAULT_SIDEBAR_SECTION_STATE: Record<SidebarSectionKey, boolean> = {
	chats: false,
	drafts: false,
	needs_review: false,
	running: false,
	completed: false,
	archived: true,
};

export interface ChatRuntimeActivity {
	threadId: string;
	phase: "active" | "settling";
	startedAt: number;
	currentToolName?: string;
	currentLabel?: string;
	detailText?: string;
	assistantPreview?: string;
	lastCompletedLabel?: string;
	lastError?: string;
}

export interface SidebarSectionContextMenuState {
	section: SidebarSectionKey;
	x: number;
	y: number;
}

export const RUNTIME_ACTIVITY_LINGER_MS = 900;

const TOOL_LABEL_MAP: Record<string, string> = {
	web_search: "Searching web",
	browser: "Opening page",
	piwork_search: "Searching folders",
	piwork_resources: "Reading workspace",
	piwork_artifacts: "Saving artifact",
	piwork_home: "Updating home files",
	generate_image: "Generating image",
	generate_media: "Generating media",
	inspect_image: "Inspecting image",
	read: "Reading file",
	edit: "Editing file",
	bash: "Running command",
	grep: "Searching code",
	find: "Finding files",
	fetch: "Fetching URL",
};

const toolLabel = (name: string): string =>
	TOOL_LABEL_MAP[name] ?? `Running ${name}`;

export const formatDate = (value: string): string =>
	new Intl.DateTimeFormat(undefined, {
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
	}).format(new Date(value));

export const formatRelativeTime = (dateStr: string): string => {
	const now = Date.now();
	const then = new Date(dateStr).getTime();
	const diffSeconds = Math.max(0, Math.floor((now - then) / 1000));
	if (diffSeconds < 60) return "now";
	const diffMinutes = Math.floor(diffSeconds / 60);
	if (diffMinutes < 60) return `${diffMinutes}m`;
	const diffHours = Math.floor(diffMinutes / 60);
	if (diffHours < 24) return `${diffHours}h`;
	const diffDays = Math.floor(diffHours / 24);
	if (diffDays < 14) return `${diffDays}d`;
	const diffWeeks = Math.floor(diffDays / 7);
	if (diffWeeks < 8) return `${diffWeeks}w`;
	const diffMonths = Math.floor(diffDays / 30);
	return `${diffMonths}mo`;
};

export const previewText = (text: string, max = 100): string => {
	const collapsed = text.replace(/\s+/g, " ").trim();
	return collapsed.length <= max ? collapsed : `${collapsed.slice(0, max - 1)}…`;
};

export const getNextChatIdAfterClose = (dashboard: DashboardState, currentChatId: string): string | null =>
	dashboard.chats.find((chat) => chat.id !== currentChatId && chat.status !== "archived")?.id ??
	dashboard.chats.find((chat) => chat.id !== currentChatId)?.id ??
	null;

export const deriveChatTitle = (text: string): string => {
	const stripped = text.replace(/@[a-z0-9_-]+\b/gi, "").trim();
	if (!stripped) return "New thread";
	const firstLine = stripped.split("\n")[0]?.trim() ?? "New thread";
	return firstLine.length <= 56 ? firstLine : `${firstLine.slice(0, 55)}…`;
};

export const matchesQuery = (query: string, ...parts: Array<string | undefined>): boolean => {
	const normalized = query.trim().toLowerCase();
	if (!normalized) return true;
	return parts.join(" ").toLowerCase().includes(normalized);
};

export const getLastUserMessage = (chat: ChatThread | null): ChatMessage | null => {
	if (!chat) return null;
	for (let index = chat.messages.length - 1; index >= 0; index -= 1) {
		const message = chat.messages[index];
		if (message?.role === "user") return message;
	}
	return null;
};

export const filterArtifacts = (
	artifacts: DashboardState["artifacts"],
	filters: {
		artifactKindFilter: ArtifactKind | "all";
		artifactChatFilter: string;
		artifactTagFilters: string[];
		artifactSearchQuery: string;
	},
) =>
	artifacts.filter((artifact) => {
		if (filters.artifactKindFilter !== "all" && artifact.kind !== filters.artifactKindFilter) return false;
		if (filters.artifactChatFilter !== "all" && artifact.createdByChatId !== filters.artifactChatFilter) return false;
		if (filters.artifactTagFilters.length > 0 && !filters.artifactTagFilters.every((tag) => artifact.tags.includes(tag))) {
			return false;
		}
		if (!matchesQuery(filters.artifactSearchQuery, artifact.title, artifact.fileName, artifact.excerpt, artifact.tags.join(" "))) {
			return false;
		}
		return true;
	});

export const applyRuntimeEvent = (
	current: Record<string, ChatRuntimeActivity>,
	event: OmpStreamEvent,
): Record<string, ChatRuntimeActivity> => {
	const existing = current[event.threadId];

	switch (event.type) {
		case "turn_start":
			return {
				...current,
				[event.threadId]: {
					threadId: event.threadId,
					phase: "active",
					startedAt: Date.now(),
				},
			};
		case "assistant_text_delta": {
			if (!existing) return current;
			const prev = existing.assistantPreview ?? "";
			const next = prev + event.delta;
			return {
				...current,
				[event.threadId]: {
					...existing,
					assistantPreview: next.length > 200 ? next.slice(next.length - 200) : next,
					currentToolName: undefined,
					currentLabel: undefined,
					detailText: undefined,
				},
			};
		}
		case "tool_start":
			if (!existing) return current;
			return {
				...current,
				[event.threadId]: {
					...existing,
					currentToolName: event.toolName,
					currentLabel: toolLabel(event.toolName),
					detailText: undefined,
					assistantPreview: undefined,
				},
			};
		case "tool_update":
			if (!existing) return current;
			return {
				...current,
				[event.threadId]: {
					...existing,
					detailText: event.detail,
				},
			};
		case "tool_end":
			if (!existing) return current;
			return {
				...current,
				[event.threadId]: {
					...existing,
					lastCompletedLabel: existing.currentLabel,
					currentToolName: undefined,
					currentLabel: undefined,
					detailText: undefined,
				},
			};
		case "error":
			if (!existing) return current;
			return {
				...current,
				[event.threadId]: {
					...existing,
					lastError: event.message,
				},
			};
		case "turn_end": {
			if (!existing) return current;
			return {
				...current,
				[event.threadId]: {
					...existing,
					phase: "settling",
				},
			};
		}
		default:
			return current;
	}
};
