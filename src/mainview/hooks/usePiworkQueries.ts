import { useMutation, useQuery } from "@tanstack/react-query";
import type {
	AddWorkspaceParams,
	ArtifactDetail,
	ChatThread,
	CreateChatParams,
	DashboardState,
	RenameWorkspaceParams,
	SendChatMessageParams,
	SendChatMessageResponse,
	UpdateArtifactParams,
	UpdateArtifactResponse,
} from "../../shared/view-rpc";
import {
	addWorkspaceViaBun,
	applyUpdateViaBun,
	archiveChatViaBun,
	cancelActiveRunViaBun,
	checkForUpdateViaBun,
	createChatViaBun,
	deleteArtifactViaBun,
	deleteChatViaBun,
	downloadUpdateViaBun,
	getApiKeyStatusViaBun,
	getAppInfoViaBun,
	getArtifactViaBun,
	getChatViaBun,
	getDashboardStateViaBun,
	removeApiKeyViaBun,
	removeWorkspaceViaBun,
	renameWorkspaceViaBun,
	retryLastMessageViaBun,
	sendChatMessageViaBun,
	setApiKeyViaBun,
	setSemanticSearchEnabledViaBun,
	setSelectedModelViaBun,
	updateArtifactViaBun,
} from "../rpc";

export const queryKeys = {
	dashboard: ["dashboard"] as const,
	appInfo: ["appInfo"] as const,
	apiKeyStatus: ["apiKeyStatus"] as const,
	chat: (chatId: string | null) => ["chat", chatId] as const,
	artifact: (artifactId: string | null) => ["artifact", artifactId] as const,
};

export const useDashboardQuery = (enabled: boolean) =>
	useQuery({
		queryKey: queryKeys.dashboard,
		queryFn: getDashboardStateViaBun,
		enabled,
	});

export const useAppInfoQuery = (enabled: boolean) =>
	useQuery({
		queryKey: queryKeys.appInfo,
		queryFn: getAppInfoViaBun,
		enabled,
	});

export const useApiKeyStatusQuery = (enabled: boolean) =>
	useQuery({
		queryKey: queryKeys.apiKeyStatus,
		queryFn: getApiKeyStatusViaBun,
		enabled,
	});

export const useChatQuery = (chatId: string | null, enabled: boolean) =>
	useQuery<ChatThread>({
		queryKey: queryKeys.chat(chatId),
		queryFn: () => getChatViaBun(chatId!),
		enabled: enabled && Boolean(chatId),
	});

export const useArtifactQuery = (artifactId: string | null, enabled: boolean) =>
	useQuery<ArtifactDetail>({
		queryKey: queryKeys.artifact(artifactId),
		queryFn: () => getArtifactViaBun(artifactId!),
		enabled: enabled && Boolean(artifactId),
	});

export const useCreateChatMutation = () =>
	useMutation<ChatThread, Error, CreateChatParams>({
		mutationFn: createChatViaBun,
	});

export const useSendChatMessageMutation = () =>
	useMutation<SendChatMessageResponse, Error, SendChatMessageParams>({
		mutationFn: sendChatMessageViaBun,
	});

export const useCancelActiveRunMutation = () =>
	useMutation<SendChatMessageResponse, Error, string>({
		mutationFn: cancelActiveRunViaBun,
	});

export const useRetryLastMessageMutation = () =>
	useMutation<SendChatMessageResponse, Error, string>({
		mutationFn: retryLastMessageViaBun,
	});

export const useArchiveChatMutation = () =>
	useMutation<DashboardState, Error, { chatId: string; archived: boolean }>({
		mutationFn: ({ chatId, archived }) => archiveChatViaBun(chatId, archived),
	});

export const useDeleteChatMutation = () =>
	useMutation<DashboardState, Error, string>({
		mutationFn: deleteChatViaBun,
	});

export const useDeleteArtifactMutation = () =>
	useMutation<DashboardState, Error, string>({
		mutationFn: deleteArtifactViaBun,
	});

export const useAddWorkspaceMutation = () =>
	useMutation<DashboardState, Error, AddWorkspaceParams>({
		mutationFn: addWorkspaceViaBun,
	});

export const useRenameWorkspaceMutation = () =>
	useMutation<DashboardState, Error, RenameWorkspaceParams>({
		mutationFn: renameWorkspaceViaBun,
	});

export const useRemoveWorkspaceMutation = () =>
	useMutation<DashboardState, Error, string>({
		mutationFn: removeWorkspaceViaBun,
	});

export const useUpdateArtifactMutation = () =>
	useMutation<UpdateArtifactResponse, Error, UpdateArtifactParams>({
		mutationFn: updateArtifactViaBun,
	});

export const useSetSelectedModelMutation = () =>
	useMutation<DashboardState, Error, string | undefined>({
		mutationFn: setSelectedModelViaBun,
	});

export const useSetSemanticSearchEnabledMutation = () =>
	useMutation({
		mutationFn: setSemanticSearchEnabledViaBun,
	});

export const useCheckForUpdateMutation = () =>
	useMutation({
		mutationFn: checkForUpdateViaBun,
	});

export const useDownloadUpdateMutation = () =>
	useMutation({
		mutationFn: downloadUpdateViaBun,
	});

export const useApplyUpdateMutation = () =>
	useMutation({
		mutationFn: applyUpdateViaBun,
	});

export const useSetApiKeyMutation = () =>
	useMutation({
		mutationFn: ({ provider, apiKey }: { provider: string; apiKey: string }) =>
			setApiKeyViaBun(provider, apiKey),
	});

export const useRemoveApiKeyMutation = () =>
	useMutation({
		mutationFn: (provider: string) => removeApiKeyViaBun(provider),
	});
