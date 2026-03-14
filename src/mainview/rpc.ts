import { Electroview } from "electrobun/view";
import type {
	AddWorkspaceParams,
	ApiKeyProviderStatus,
	AppInfo,
	ArtifactDetail,
	AvailableModel,
	ChatThread,
	CreateChatParams,
	DashboardState,
	ModelStatus,
	OmpStreamEvent,
	PiworkViewRPCSchema,
	RenameWorkspaceParams,
	SendChatMessageParams,
	SendChatMessageResponse,
	UpdateStatusEntry,
	UpdateArtifactParams,
	UpdateArtifactResponse,
} from "../shared/view-rpc";

const isElectrobunRuntime =
	typeof window !== "undefined" && typeof window.__electrobunWebviewId === "number";

let rpcInstance: ReturnType<typeof Electroview.defineRPC<PiworkViewRPCSchema>> | null = null;

if (isElectrobunRuntime) {
	rpcInstance = Electroview.defineRPC<PiworkViewRPCSchema>({
		maxRequestTime: 10 * 60 * 1000,
		handlers: {
			requests: {},
			messages: {},
		},
	});
	new Electroview({ rpc: rpcInstance });
}

const ensureBridge = (): NonNullable<typeof rpcInstance> => {
	if (!rpcInstance) throw new Error("Electrobun RPC bridge unavailable.");
	return rpcInstance;
};

export const hasBunBridge = (): boolean => rpcInstance !== null;

export const getDashboardStateViaBun = async (): Promise<DashboardState> =>
	ensureBridge().request.getDashboardState({});

export const getAppInfoViaBun = async (): Promise<AppInfo> =>
	ensureBridge().request.getAppInfo({});

export const getChatViaBun = async (id: string): Promise<ChatThread> =>
	ensureBridge().request.getChat({ id });

export const createChatViaBun = async (params: CreateChatParams): Promise<ChatThread> =>
	ensureBridge().request.createChat(params);

export const sendChatMessageViaBun = async (
	params: SendChatMessageParams,
): Promise<SendChatMessageResponse> =>
	ensureBridge().request.sendChatMessage(params);

export const getArtifactViaBun = async (id: string): Promise<ArtifactDetail> =>
	ensureBridge().request.getArtifact({ id });

export const updateArtifactViaBun = async (
	params: UpdateArtifactParams,
): Promise<UpdateArtifactResponse> =>
	ensureBridge().request.updateArtifact(params);

export const setSelectedModelViaBun = async (modelId?: string): Promise<DashboardState> =>
	ensureBridge().request.setSelectedModel({ modelId });

export const setSemanticSearchEnabledViaBun = async (enabled: boolean): Promise<AppInfo> =>
	ensureBridge().request.setSemanticSearchEnabled({ enabled });

export const showArtifactInFinderViaBun = async (artifactId: string): Promise<void> => {
	await ensureBridge().request.showArtifactInFinder({ artifactId });
};

export const openPiworkFolderViaBun = async (): Promise<void> => {
	await ensureBridge().request.openPiworkFolder({});
};

export const pickWorkspaceFolderViaBun = async (): Promise<{ paths: string[] }> =>
	ensureBridge().request.pickWorkspaceFolder({});

export const addWorkspaceViaBun = async (params: AddWorkspaceParams): Promise<DashboardState> =>
	ensureBridge().request.addWorkspace(params);

export const renameWorkspaceViaBun = async (
	params: RenameWorkspaceParams,
): Promise<DashboardState> =>
	ensureBridge().request.renameWorkspace(params);

export const removeWorkspaceViaBun = async (workspaceId: string): Promise<DashboardState> =>
	ensureBridge().request.removeWorkspace({ workspaceId });

export const archiveChatViaBun = async (
	chatId: string,
	archived: boolean,
): Promise<DashboardState> =>
	ensureBridge().request.archiveChat({ chatId, archived });

export const markChatReviewedViaBun = async (chatId: string): Promise<DashboardState> =>
	ensureBridge().request.markChatReviewed({ chatId });

export const deleteChatViaBun = async (chatId: string): Promise<DashboardState> =>
	ensureBridge().request.deleteChat({ chatId });

export const deleteArtifactViaBun = async (artifactId: string): Promise<DashboardState> =>
	ensureBridge().request.deleteArtifact({ artifactId });

export const getAvailableModelsViaBun = async (): Promise<{ models: AvailableModel[]; error?: string }> =>
	ensureBridge().request.getAvailableModels({});

export const pickFilesViaBun = async (): Promise<{ paths: string[] }> =>
	ensureBridge().request.pickFiles({});

export const cancelActiveRunViaBun = async (
	chatId: string,
): Promise<SendChatMessageResponse> =>
	ensureBridge().request.cancelActiveRun({ chatId });

export const retryLastMessageViaBun = async (
	chatId: string,
): Promise<SendChatMessageResponse> =>
	ensureBridge().request.retryLastMessage({ chatId });

export const checkForUpdateViaBun = async (): Promise<AppInfo> =>
	ensureBridge().request.checkForUpdate({});

export const downloadUpdateViaBun = async (): Promise<AppInfo> =>
	ensureBridge().request.downloadUpdate({});

export const applyUpdateViaBun = async (): Promise<void> => {
	await ensureBridge().request.applyUpdate({});
};

export const getApiKeyStatusViaBun = async (): Promise<{ providers: ApiKeyProviderStatus[] }> =>
	ensureBridge().request.getApiKeyStatus({});

export const setApiKeyViaBun = async (
	provider: string,
	apiKey: string,
): Promise<{ providers: ApiKeyProviderStatus[]; modelStatus: ModelStatus }> =>
	ensureBridge().request.setApiKey({ provider, apiKey });

export const removeApiKeyViaBun = async (
	provider: string,
): Promise<{ providers: ApiKeyProviderStatus[]; modelStatus: ModelStatus }> =>
	ensureBridge().request.removeApiKey({ provider });

export const addOmpEventListenerViaBun = (
	listener: (event: OmpStreamEvent) => void,
): (() => void) => {
	const bridge = ensureBridge();
	bridge.addMessageListener("ompEvent", listener);
	return () => {
		bridge.removeMessageListener("ompEvent", listener);
	};
};

export const addUpdateStatusListenerViaBun = (
	listener: (event: UpdateStatusEntry) => void,
): (() => void) => {
	const bridge = ensureBridge();
	bridge.addMessageListener("updateStatus", listener);
	return () => {
		bridge.removeMessageListener("updateStatus", listener);
	};
};

export const addUpdateAvailableListenerViaBun = (
	listener: (event: { version: string }) => void,
): (() => void) => {
	const bridge = ensureBridge();
	bridge.addMessageListener("updateAvailableNotification", listener);
	return () => {
		bridge.removeMessageListener("updateAvailableNotification", listener);
	};
};
