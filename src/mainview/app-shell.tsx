import {
	createContext,
	useContext,
	useMemo,
	useReducer,
	type ReactNode,
} from "react";
import type { ArtifactKind, UpdateStatusEntry } from "../shared/view-rpc";
import {
	DEFAULT_SIDEBAR_SECTION_STATE,
	type ChatRuntimeActivity,
	type SidebarSectionKey,
	type ViewMode,
} from "./app-shared";

type AppShellState = {
	initialized: boolean;
	activeView: ViewMode;
	activeChatId: string | null;
	activeArtifactId: string | null;
	artifactModalId: string | null;
	workspaceDrafts: Record<string, string>;
	apiKeyDrafts: Record<string, string>;
	chatSearchQuery: string;
	artifactSearchQuery: string;
	collapsedSidebarSections: Record<SidebarSectionKey, boolean>;
	artifactKindFilter: ArtifactKind | "all";
	artifactChatFilter: string;
	artifactTagFilters: string[];
	artifactTagTrayOpen: boolean;
	artifactShowAllTags: boolean;
	pendingChatIds: string[];
	runtimeActivityByChatId: Record<string, ChatRuntimeActivity>;
	latestUpdateStatus?: UpdateStatusEntry;
	composerFocusToken: number;
};

type AppShellAction =
	| { type: "set_initialized"; value: boolean }
	| { type: "set_active_view"; value: ViewMode }
	| { type: "set_active_chat_id"; value: string | null }
	| { type: "set_active_artifact_id"; value: string | null }
	| { type: "set_artifact_modal_id"; value: string | null }
	| { type: "set_workspace_drafts"; value: Record<string, string> }
	| { type: "patch_workspace_draft"; workspaceId: string; value: string }
	| { type: "set_api_key_drafts"; value: Record<string, string> }
	| { type: "patch_api_key_draft"; provider: string; value: string }
	| { type: "remove_api_key_draft"; provider: string }
	| { type: "set_chat_search_query"; value: string }
	| { type: "set_artifact_search_query"; value: string }
	| { type: "toggle_sidebar_section"; key: SidebarSectionKey }
	| { type: "set_artifact_kind_filter"; value: ArtifactKind | "all" }
	| { type: "set_artifact_chat_filter"; value: string }
	| { type: "set_artifact_tag_filters"; value: string[] }
	| { type: "set_artifact_tag_tray_open"; value: boolean }
	| { type: "set_artifact_show_all_tags"; value: boolean }
	| { type: "set_pending_chat_ids"; value: string[] }
	| { type: "add_pending_chat_id"; value: string }
	| { type: "remove_pending_chat_id"; value: string }
	| { type: "set_runtime_activity"; value: Record<string, ChatRuntimeActivity> }
	| { type: "set_latest_update_status"; value: UpdateStatusEntry | undefined }
	| { type: "bump_composer_focus_token" }
	| { type: "clear_artifact_filters" };

const initialState: AppShellState = {
	initialized: false,
	activeView: "chat",
	activeChatId: null,
	activeArtifactId: null,
	artifactModalId: null,
	workspaceDrafts: {},
	apiKeyDrafts: {},
	chatSearchQuery: "",
	artifactSearchQuery: "",
	collapsedSidebarSections: DEFAULT_SIDEBAR_SECTION_STATE,
	artifactKindFilter: "all",
	artifactChatFilter: "all",
	artifactTagFilters: [],
	artifactTagTrayOpen: false,
	artifactShowAllTags: false,
	pendingChatIds: [],
	runtimeActivityByChatId: {},
	latestUpdateStatus: undefined,
	composerFocusToken: 0,
};

const reducer = (state: AppShellState, action: AppShellAction): AppShellState => {
	switch (action.type) {
		case "set_initialized":
			return { ...state, initialized: action.value };
		case "set_active_view":
			return { ...state, activeView: action.value };
		case "set_active_chat_id":
			return { ...state, activeChatId: action.value };
		case "set_active_artifact_id":
			return { ...state, activeArtifactId: action.value };
		case "set_artifact_modal_id":
			return { ...state, artifactModalId: action.value };
		case "set_workspace_drafts":
			return { ...state, workspaceDrafts: action.value };
		case "patch_workspace_draft":
			return {
				...state,
				workspaceDrafts: { ...state.workspaceDrafts, [action.workspaceId]: action.value },
			};
		case "set_api_key_drafts":
			return { ...state, apiKeyDrafts: action.value };
		case "patch_api_key_draft":
			return {
				...state,
				apiKeyDrafts: { ...state.apiKeyDrafts, [action.provider]: action.value },
			};
		case "remove_api_key_draft": {
			const next = { ...state.apiKeyDrafts };
			delete next[action.provider];
			return { ...state, apiKeyDrafts: next };
		}
		case "set_chat_search_query":
			return { ...state, chatSearchQuery: action.value };
		case "set_artifact_search_query":
			return { ...state, artifactSearchQuery: action.value };
		case "toggle_sidebar_section":
			return {
				...state,
				collapsedSidebarSections: {
					...state.collapsedSidebarSections,
					[action.key]: !state.collapsedSidebarSections[action.key],
				},
			};
		case "set_artifact_kind_filter":
			return { ...state, artifactKindFilter: action.value };
		case "set_artifact_chat_filter":
			return { ...state, artifactChatFilter: action.value };
		case "set_artifact_tag_filters":
			return { ...state, artifactTagFilters: action.value };
		case "set_artifact_tag_tray_open":
			return { ...state, artifactTagTrayOpen: action.value };
		case "set_artifact_show_all_tags":
			return { ...state, artifactShowAllTags: action.value };
		case "set_pending_chat_ids":
			return { ...state, pendingChatIds: action.value };
		case "add_pending_chat_id":
			return state.pendingChatIds.includes(action.value)
				? state
				: { ...state, pendingChatIds: [...state.pendingChatIds, action.value] };
		case "remove_pending_chat_id":
			return {
				...state,
				pendingChatIds: state.pendingChatIds.filter((id) => id !== action.value),
			};
		case "set_runtime_activity":
			return { ...state, runtimeActivityByChatId: action.value };
		case "set_latest_update_status":
			return { ...state, latestUpdateStatus: action.value };
		case "bump_composer_focus_token":
			return { ...state, composerFocusToken: state.composerFocusToken + 1 };
		case "clear_artifact_filters":
			return {
				...state,
				artifactSearchQuery: "",
				artifactKindFilter: "all",
				artifactChatFilter: "all",
				artifactTagFilters: [],
				artifactTagTrayOpen: false,
				artifactShowAllTags: false,
			};
		default:
			return state;
	}
};

type AppShellContextValue = {
	state: AppShellState;
	dispatch: React.Dispatch<AppShellAction>;
};

const AppShellContext = createContext<AppShellContextValue | null>(null);

export function AppShellProvider({ children }: { children: ReactNode }) {
	const [state, dispatch] = useReducer(reducer, initialState);
	const value = useMemo(() => ({ state, dispatch }), [state]);
	return <AppShellContext.Provider value={value}>{children}</AppShellContext.Provider>;
}

export const useAppShell = (): AppShellContextValue => {
	const value = useContext(AppShellContext);
	if (!value) throw new Error("AppShellProvider is missing.");
	return value;
};
