import { useQueryClient } from "@tanstack/react-query";
import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type {
	ChatMessage,
	ChatSummary,
	DashboardState,
	OmpStreamEvent,
	WorkspaceSummary,
} from "../../shared/view-rpc";
import { useAppShell } from "../app-shell";
import {
	applyRuntimeEvent,
	CHAT_STATUS_LABELS,
	CHAT_STATUS_ORDER,
	deriveChatTitle,
	filterArtifacts,
	getLastUserMessage,
	getNextChatIdAfterClose,
	matchesQuery,
	previewText,
	RUNTIME_ACTIVITY_LINGER_MS,
	type ChatRuntimeActivity,
} from "../app-shared";
import type { ComposerSubmitInput } from "../components/ChatComposer";
import {
	addOmpEventListenerViaBun,
	addUpdateAvailableListenerViaBun,
	addUpdateStatusListenerViaBun,
	getChatViaBun,
	getArtifactViaBun,
	getDashboardStateViaBun,
	hasBunBridge,
	markChatReviewedViaBun,
	openPiworkFolderViaBun,
	pickWorkspaceFolderViaBun,
} from "../rpc";
import {
	queryKeys,
	useApiKeyStatusQuery,
	useAppInfoQuery,
	useArchiveChatMutation,
	useArtifactQuery,
	useCancelActiveRunMutation,
	useChatQuery,
	useCheckForUpdateMutation,
	useCreateChatMutation,
	useDashboardQuery,
	useDeleteChatMutation,
	useDownloadUpdateMutation,
	useRemoveApiKeyMutation,
	useRemoveWorkspaceMutation,
	useRenameWorkspaceMutation,
	useRetryLastMessageMutation,
	useSendChatMessageMutation,
	useSetApiKeyMutation,
	useSetSelectedModelMutation,
	useSetSemanticSearchEnabledMutation,
	useUpdateArtifactMutation,
	useAddWorkspaceMutation,
	useApplyUpdateMutation,
} from "./usePiworkQueries";

const toErrorMessage = (error: unknown): string =>
	error instanceof Error ? error.message : String(error);

export function usePiworkAppController() {
	const bridgeAvailable = hasBunBridge();
	const queryClient = useQueryClient();
	const { state, dispatch } = useAppShell();

	const dashboardQuery = useDashboardQuery(bridgeAvailable);
	const appInfoQuery = useAppInfoQuery(bridgeAvailable);
	const apiKeyStatusQuery = useApiKeyStatusQuery(bridgeAvailable);
	const activeChatQuery = useChatQuery(state.activeChatId, bridgeAvailable);
	const activeArtifactQuery = useArtifactQuery(state.activeArtifactId, bridgeAvailable);
	const artifactModalQuery = useArtifactQuery(state.artifactModalId, bridgeAvailable);

	const createChatMutation = useCreateChatMutation();
	const sendChatMessageMutation = useSendChatMessageMutation();
	const cancelActiveRunMutation = useCancelActiveRunMutation();
	const retryLastMessageMutation = useRetryLastMessageMutation();
	const archiveChatMutation = useArchiveChatMutation();
	const deleteChatMutation = useDeleteChatMutation();
	const addWorkspaceMutation = useAddWorkspaceMutation();
	const renameWorkspaceMutation = useRenameWorkspaceMutation();
	const removeWorkspaceMutation = useRemoveWorkspaceMutation();
	const updateArtifactMutation = useUpdateArtifactMutation();
	const setSelectedModelMutation = useSetSelectedModelMutation();
	const setSemanticSearchMutation = useSetSemanticSearchEnabledMutation();
	const checkForUpdateMutation = useCheckForUpdateMutation();
	const downloadUpdateMutation = useDownloadUpdateMutation();
	const applyUpdateMutation = useApplyUpdateMutation();
	const setApiKeyMutation = useSetApiKeyMutation();
	const removeApiKeyMutation = useRemoveApiKeyMutation();

	const runtimeActivityRef = useRef<Record<string, ChatRuntimeActivity>>({});
	const runtimeCleanupTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
	const lastNotifiedVersionRef = useRef<string | null>(null);
	const [isInitializing, setIsInitializing] = useState(false);

	const dashboard = dashboardQuery.data ?? null;
	const appInfo = appInfoQuery.data ?? null;
	const apiKeyProviders = apiKeyStatusQuery.data?.providers ?? [];
	const activeChat = activeChatQuery.data ?? null;
	const activeArtifact = activeArtifactQuery.data ?? null;
	const artifactModal = artifactModalQuery.data ?? null;

	const clearRuntimeCleanup = useCallback((threadId: string) => {
		const timer = runtimeCleanupTimersRef.current[threadId];
		if (!timer) return;
		clearTimeout(timer);
		delete runtimeCleanupTimersRef.current[threadId];
	}, []);

	const commitRuntimeActivity = useCallback((next: Record<string, ChatRuntimeActivity>) => {
		runtimeActivityRef.current = next;
		startTransition(() => {
			dispatch({ type: "set_runtime_activity", value: next });
		});
	}, [dispatch]);

	const removeRuntimeActivity = useCallback((threadId: string) => {
		clearRuntimeCleanup(threadId);
		const current = runtimeActivityRef.current;
		if (!(threadId in current)) return;
		const next = { ...current };
		delete next[threadId];
		commitRuntimeActivity(next);
	}, [clearRuntimeCleanup, commitRuntimeActivity]);

	const scheduleRuntimeCleanup = useCallback((threadId: string, delayMs: number) => {
		clearRuntimeCleanup(threadId);
		runtimeCleanupTimersRef.current[threadId] = setTimeout(() => {
			delete runtimeCleanupTimersRef.current[threadId];
			removeRuntimeActivity(threadId);
		}, delayMs);
	}, [clearRuntimeCleanup, removeRuntimeActivity]);

	const handleRuntimeEvent = useCallback((event: OmpStreamEvent) => {
		if (event.type === "turn_start") clearRuntimeCleanup(event.threadId);
		const next = applyRuntimeEvent(runtimeActivityRef.current, event);
		commitRuntimeActivity(next);
		if (event.type === "turn_end") {
			scheduleRuntimeCleanup(event.threadId, RUNTIME_ACTIVITY_LINGER_MS);
		}
	}, [clearRuntimeCleanup, commitRuntimeActivity, scheduleRuntimeCleanup]);

	const refreshDashboard = useCallback(async () => {
		const nextDashboard = await queryClient.fetchQuery({
			queryKey: queryKeys.dashboard,
			queryFn: getDashboardStateViaBun,
		});
		return nextDashboard;
	}, [queryClient]);

	const refreshAppInfo = useCallback(async () => {
		const nextAppInfo = await appInfoQuery.refetch();
		if (nextAppInfo.data) {
			dispatch({ type: "set_latest_update_status", value: nextAppInfo.data.update.lastStatus });
		}
		return nextAppInfo.data ?? null;
	}, [appInfoQuery, dispatch]);

	useEffect(() => {
		runtimeActivityRef.current = state.runtimeActivityByChatId;
	}, [state.runtimeActivityByChatId]);

	useEffect(() => {
		if (!dashboard) return;
		dispatch({
			type: "set_workspace_drafts",
			value: Object.fromEntries(dashboard.workspaces.map((workspace) => [workspace.id, workspace.alias])),
		});
	}, [dashboard, dispatch]);

	useEffect(() => {
		if (!bridgeAvailable || state.initialized || isInitializing) return;
		if (!dashboard || !appInfo || !apiKeyStatusQuery.data) return;

		setIsInitializing(true);
		void (async () => {
			try {
				const existingDraft = dashboard.chats.find((chat) => chat.messageCount === 0 && chat.status !== "archived");
				let initialChatId = existingDraft?.id ?? null;
				if (!initialChatId) {
					const chat = await createChatMutation.mutateAsync({});
					queryClient.setQueryData(queryKeys.chat(chat.id), chat);
					await refreshDashboard();
					initialChatId = chat.id;
				}
				if (initialChatId) {
					await queryClient.prefetchQuery({
						queryKey: queryKeys.chat(initialChatId),
						queryFn: () => getChatViaBun(initialChatId!),
					});
					dispatch({ type: "set_active_chat_id", value: initialChatId });
				}
				dispatch({ type: "set_active_view", value: "chat" });
				dispatch({ type: "set_latest_update_status", value: appInfo.update.lastStatus });
				dispatch({ type: "set_initialized", value: true });
			} catch (error) {
				toast.error(toErrorMessage(error));
			} finally {
				setIsInitializing(false);
			}
		})();
	}, [bridgeAvailable, state.initialized, isInitializing, dashboard, appInfo, apiKeyStatusQuery.data, createChatMutation, queryClient, refreshDashboard, dispatch]);

	useEffect(() => {
		if (!bridgeAvailable) return;
		return addOmpEventListenerViaBun(handleRuntimeEvent);
	}, [bridgeAvailable, handleRuntimeEvent]);

	useEffect(() => {
		if (!bridgeAvailable) return;
		return addUpdateStatusListenerViaBun((entry) => {
			dispatch({ type: "set_latest_update_status", value: entry });
			queryClient.setQueryData(queryKeys.appInfo, (current: any) =>
				current
					? {
						...current,
						update: {
							...current.update,
							lastStatus: entry,
						},
					}
					: current,
			);
		});
	}, [bridgeAvailable, dispatch, queryClient]);

	useEffect(() => {
		if (!bridgeAvailable) return;
		return addUpdateAvailableListenerViaBun(({ version }) => {
			if (lastNotifiedVersionRef.current === version) return;
			lastNotifiedVersionRef.current = version;
			void refreshAppInfo();
			toast(`Update available: v${version}`, {
				action: {
					label: "Settings",
					onClick: () => dispatch({ type: "set_active_view", value: "settings" }),
				},
			});
		});
	}, [bridgeAvailable, refreshAppInfo, dispatch]);

	useEffect(() => {
		if (!bridgeAvailable) return;
		if (!appInfo?.search || !["indexing", "embedding"].includes(appInfo.search.status)) return;
		const interval = setInterval(() => {
			void refreshAppInfo();
		}, 2500);
		return () => clearInterval(interval);
	}, [bridgeAvailable, appInfo?.search, refreshAppInfo]);

	useEffect(
		() => () => {
			for (const timer of Object.values(runtimeCleanupTimersRef.current)) {
				clearTimeout(timer);
			}
			runtimeCleanupTimersRef.current = {};
		},
		[],
	);

	const openChatById = useCallback(async (chatId: string, nextDashboard?: DashboardState) => {
		let chat = await queryClient.fetchQuery({
			queryKey: queryKeys.chat(chatId),
			queryFn: () => getChatViaBun(chatId),
		});
		let resolvedDashboard = nextDashboard;
		if (chat.status === "needs_review") {
			resolvedDashboard = await markChatReviewedViaBun(chatId);
			queryClient.setQueryData(queryKeys.dashboard, resolvedDashboard);
			chat = await getChatViaBun(chatId);
			queryClient.setQueryData(queryKeys.chat(chatId), chat);
		}
		dispatch({ type: "set_active_chat_id", value: chatId });
		dispatch({ type: "set_active_view", value: "chat" });
		if (resolvedDashboard) {
			queryClient.setQueryData(queryKeys.dashboard, resolvedDashboard);
		}
	}, [dispatch, queryClient]);

	const handleCreateChat = useCallback(async () => {
		try {
			const chat = await createChatMutation.mutateAsync({});
			queryClient.setQueryData(queryKeys.chat(chat.id), chat);
			await refreshDashboard();
			dispatch({ type: "set_active_chat_id", value: chat.id });
			dispatch({ type: "set_active_view", value: "chat" });
			dispatch({ type: "bump_composer_focus_token" });
		} catch (error) {
			toast.error(toErrorMessage(error));
		}
	}, [createChatMutation, queryClient, refreshDashboard, dispatch]);

	useEffect(() => {
		const handleKey = (event: KeyboardEvent) => {
			if (event.key.toLowerCase() !== "n") return;
			if (!event.metaKey && !event.ctrlKey) return;
			event.preventDefault();
			void handleCreateChat();
		};
		document.addEventListener("keydown", handleKey);
		return () => document.removeEventListener("keydown", handleKey);
	}, [handleCreateChat]);

	const handleSelectedModelChange = async (modelId?: string) => {
		try {
			const nextDashboard = await setSelectedModelMutation.mutateAsync(modelId);
			queryClient.setQueryData(queryKeys.dashboard, nextDashboard);
			queryClient.setQueryData(queryKeys.appInfo, (current: any) =>
				current ? { ...current, selectedModelId: nextDashboard.selectedModelId } : current,
			);
		} catch (error) {
			toast.error(toErrorMessage(error));
		}
	};

	const handleCancelActiveRun = async () => {
		if (!state.activeChatId) return;
		try {
			const response = await cancelActiveRunMutation.mutateAsync(state.activeChatId);
			removeRuntimeActivity(state.activeChatId);
			queryClient.setQueryData(queryKeys.dashboard, response.dashboard);
			queryClient.setQueryData(queryKeys.chat(response.chat.id), response.chat);
		} catch (error) {
			toast.error(toErrorMessage(error));
		}
	};

	const handleRetryLastPrompt = async () => {
		if (!state.activeChatId) return;
		try {
			clearRuntimeCleanup(state.activeChatId);
			commitRuntimeActivity({
				...runtimeActivityRef.current,
				[state.activeChatId]: {
					threadId: state.activeChatId,
					phase: "active",
					startedAt: Date.now(),
				},
			});
			dispatch({ type: "add_pending_chat_id", value: state.activeChatId });
			const response = await retryLastMessageMutation.mutateAsync(state.activeChatId);
			queryClient.setQueryData(queryKeys.dashboard, response.dashboard);
			queryClient.setQueryData(queryKeys.chat(response.chat.id), response.chat);
			dispatch({ type: "set_active_view", value: "chat" });
		} catch (error) {
			removeRuntimeActivity(state.activeChatId);
			toast.error(toErrorMessage(error));
		} finally {
			dispatch({ type: "remove_pending_chat_id", value: state.activeChatId });
		}
	};

	const handleComposerSubmit = async (input: ComposerSubmitInput) => {
		const trimmed = input.prompt.trim();
		if (!trimmed) return;
		let submittingChatId: string | null = null;

		try {
			let targetChat = activeChat;
			if (!targetChat) {
				targetChat = await createChatMutation.mutateAsync({});
				queryClient.setQueryData(queryKeys.chat(targetChat.id), targetChat);
				await refreshDashboard();
				dispatch({ type: "set_active_chat_id", value: targetChat.id });
			}
			if (!targetChat) return;

			const optimisticMessage: ChatMessage = {
				id: `local-${Date.now()}`,
				role: "user",
				content: trimmed,
				createdAt: new Date().toISOString(),
				workspaceMentions: [],
				artifactIds: input.mentionedArtifactIds ?? [],
			};

			queryClient.setQueryData(queryKeys.chat(targetChat.id), (current: any) =>
				current
					? {
						...current,
						title: current.title === "New thread" ? deriveChatTitle(trimmed) : current.title,
						messages: [...current.messages, optimisticMessage],
					}
					: current,
			);
			queryClient.setQueryData(queryKeys.dashboard, (current: DashboardState | undefined) => {
				if (!current) return current;
				const existing = current.chats.find((chat) => chat.id === targetChat!.id);
				const optimisticSummary: ChatSummary = {
					id: targetChat!.id,
					title:
						(existing?.title ?? targetChat!.title) === "New thread"
							? deriveChatTitle(trimmed)
							: (existing?.title ?? targetChat!.title),
					status: "running",
					createdAt: existing?.createdAt ?? targetChat!.createdAt,
					updatedAt: optimisticMessage.createdAt,
					lastMessagePreview: previewText(trimmed),
					messageCount: Math.max((existing?.messageCount ?? 0) + 1, targetChat!.messageCount + 1),
					workspaceMentions: existing?.workspaceMentions ?? targetChat!.workspaceMentions,
				};
				return {
					...current,
					chats: [optimisticSummary, ...current.chats.filter((chat) => chat.id !== targetChat!.id)],
				};
			});

			submittingChatId = targetChat.id;
			dispatch({ type: "add_pending_chat_id", value: targetChat.id });
			clearRuntimeCleanup(targetChat.id);
			commitRuntimeActivity({
				...runtimeActivityRef.current,
				[targetChat.id]: {
					threadId: targetChat.id,
					phase: "active",
					startedAt: Date.now(),
				},
			});

			let response = await sendChatMessageMutation.mutateAsync({
				chatId: targetChat.id,
				content: trimmed,
				modelId: input.modelId,
				attachmentPaths: input.attachmentPaths,
				mentionedArtifactIds: input.mentionedArtifactIds,
			});
			if (
				response.chat.status === "needs_review" &&
				state.activeView === "chat" &&
				state.activeChatId === targetChat.id
			) {
				const nextDashboard = await markChatReviewedViaBun(targetChat.id);
				const nextChat = await getChatViaBun(targetChat.id);
				response = { dashboard: nextDashboard, chat: nextChat };
			}
			queryClient.setQueryData(queryKeys.dashboard, response.dashboard);
			queryClient.setQueryData(queryKeys.chat(response.chat.id), response.chat);
			dispatch({ type: "set_active_chat_id", value: response.chat.id });
			dispatch({ type: "set_active_view", value: "chat" });
		} catch (error) {
			toast.error(toErrorMessage(error));
			if (submittingChatId) removeRuntimeActivity(submittingChatId);
		} finally {
			if (submittingChatId) dispatch({ type: "remove_pending_chat_id", value: submittingChatId });
		}
	};

	const handleOpenArtifact = async (artifactId: string, options?: { modal?: boolean }) => {
		try {
			const artifact = await queryClient.fetchQuery({
				queryKey: queryKeys.artifact(artifactId),
				queryFn: () => getArtifactViaBun(artifactId),
			});
			if (options?.modal ?? state.activeView === "chat") {
				dispatch({ type: "set_artifact_modal_id", value: artifact.id });
			} else {
				dispatch({ type: "set_active_artifact_id", value: artifact.id });
				dispatch({ type: "set_active_view", value: "artifact-detail" });
			}
		} catch (error) {
			toast.error(toErrorMessage(error));
		}
	};

	const handleAddWorkspace = async () => {
		try {
			const { paths } = await pickWorkspaceFolderViaBun();
			if (paths.length === 0) return;
			let nextDashboard = dashboard;
			for (const path of paths) {
				nextDashboard = await addWorkspaceMutation.mutateAsync({ path });
			}
			if (nextDashboard) {
				queryClient.setQueryData(queryKeys.dashboard, nextDashboard);
				queryClient.setQueryData(queryKeys.appInfo, (current: any) =>
					current ? { ...current, selectedModelId: nextDashboard.selectedModelId } : current,
				);
			}
			dispatch({ type: "set_active_view", value: "settings" });
		} catch (error) {
			toast.error(toErrorMessage(error));
		}
	};

	const handleOpenPiworkFolder = async () => {
		try {
			await openPiworkFolderViaBun();
		} catch (error) {
			toast.error(toErrorMessage(error));
		}
	};

	const handleSaveWorkspace = async (workspace: WorkspaceSummary) => {
		const alias = (state.workspaceDrafts[workspace.id] ?? workspace.alias).trim();
		if (!alias || alias === workspace.alias) return;
		try {
			const nextDashboard = await renameWorkspaceMutation.mutateAsync({ workspaceId: workspace.id, alias });
			queryClient.setQueryData(queryKeys.dashboard, nextDashboard);
		} catch (error) {
			toast.error(toErrorMessage(error));
		}
	};

	const handleRemoveWorkspace = async (workspaceId: string) => {
		try {
			const nextDashboard = await removeWorkspaceMutation.mutateAsync(workspaceId);
			queryClient.setQueryData(queryKeys.dashboard, nextDashboard);
		} catch (error) {
			toast.error(toErrorMessage(error));
		}
	};

	const handleCheckForUpdates = async () => {
		try {
			const nextAppInfo = await checkForUpdateMutation.mutateAsync();
			queryClient.setQueryData(queryKeys.appInfo, nextAppInfo);
			dispatch({ type: "set_latest_update_status", value: nextAppInfo.update.lastStatus });
		} catch (error) {
			toast.error(toErrorMessage(error));
		}
	};

	const handleDownloadUpdate = async () => {
		try {
			const nextAppInfo = await downloadUpdateMutation.mutateAsync();
			queryClient.setQueryData(queryKeys.appInfo, nextAppInfo);
			dispatch({ type: "set_latest_update_status", value: nextAppInfo.update.lastStatus });
		} catch (error) {
			toast.error(toErrorMessage(error));
		}
	};

	const handleApplyUpdate = async () => {
		try {
			await applyUpdateMutation.mutateAsync();
		} catch (error) {
			toast.error(toErrorMessage(error));
		}
	};

	const handleSetSemanticSearchEnabled = async (enabled: boolean) => {
		try {
			const nextAppInfo = await setSemanticSearchMutation.mutateAsync(enabled);
			queryClient.setQueryData(queryKeys.appInfo, nextAppInfo);
		} catch (error) {
			toast.error(toErrorMessage(error));
		}
	};

	const handleArchiveChat = async (chatId: string, archived: boolean) => {
		try {
			const nextDashboard = await archiveChatMutation.mutateAsync({ chatId, archived });
			queryClient.setQueryData(queryKeys.dashboard, nextDashboard);
			if (state.activeChatId === chatId && archived) {
				const nextChatId = getNextChatIdAfterClose(nextDashboard, chatId);
				if (nextChatId) {
					await openChatById(nextChatId, nextDashboard);
				} else {
					await handleCreateChat();
				}
				return;
			}
			if (state.activeChatId === chatId) {
				const chat = await getChatViaBun(chatId);
				queryClient.setQueryData(queryKeys.chat(chatId), chat);
			}
		} catch (error) {
			toast.error(toErrorMessage(error));
		}
	};

	const handleCloseCurrentChat = useCallback(async () => {
		if (state.activeView !== "chat" || !state.activeChatId) return;
		await handleArchiveChat(state.activeChatId, true);
	}, [state.activeView, state.activeChatId]);

	useEffect(() => {
		const handleKey = (event: KeyboardEvent) => {
			if (event.key.toLowerCase() !== "w") return;
			if (!event.metaKey || event.ctrlKey || event.altKey) return;
			event.preventDefault();
			void handleCloseCurrentChat();
		};
		document.addEventListener("keydown", handleKey);
		return () => document.removeEventListener("keydown", handleKey);
	}, [handleCloseCurrentChat]);

	const handleArchiveCompletedChats = async () => {
		const completedChats = dashboard?.chats.filter((chat) => chat.status === "completed") ?? [];
		if (completedChats.length === 0) return;
		try {
			let nextDashboard = dashboard;
			for (const chat of completedChats) {
				nextDashboard = await archiveChatMutation.mutateAsync({ chatId: chat.id, archived: true });
			}
			if (nextDashboard) queryClient.setQueryData(queryKeys.dashboard, nextDashboard);
			if (state.activeChatId && completedChats.some((chat) => chat.id === state.activeChatId)) {
				const nextActiveChat = await getChatViaBun(state.activeChatId);
				queryClient.setQueryData(queryKeys.chat(state.activeChatId), nextActiveChat);
			}
		} catch (error) {
			toast.error(toErrorMessage(error));
		}
	};

	const handleDeleteChat = async (chatId: string) => {
		try {
			const nextDashboard = await deleteChatMutation.mutateAsync(chatId);
			queryClient.setQueryData(queryKeys.dashboard, nextDashboard);
			if (state.activeChatId === chatId) {
				const nextChatId = nextDashboard.chats[0]?.id ?? null;
				dispatch({ type: "set_active_chat_id", value: nextChatId });
				if (nextChatId) {
					dispatch({ type: "set_active_view", value: "chat" });
				} else if (state.activeView === "chat") {
					dispatch({ type: "set_active_view", value: "artifacts" });
				}
			}
		} catch (error) {
			toast.error(toErrorMessage(error));
		}
	};

	const handleSaveArtifactTags = async (artifactId: string, tags: string[]) => {
		try {
			const response = await updateArtifactMutation.mutateAsync({ artifactId, tags });
			queryClient.setQueryData(queryKeys.dashboard, response.dashboard);
			queryClient.setQueryData(queryKeys.artifact(artifactId), response.artifact);
			if (state.activeChatId) {
				const currentChat = queryClient.getQueryData<any>(queryKeys.chat(state.activeChatId));
				if (currentChat?.artifacts?.some((artifact: any) => artifact.id === artifactId)) {
					const chat = await getChatViaBun(state.activeChatId);
					queryClient.setQueryData(queryKeys.chat(state.activeChatId), chat);
				}
			}
		} catch (error) {
			toast.error(toErrorMessage(error));
		}
	};

	const handleSaveApiKey = async (provider: string) => {
		const apiKey = state.apiKeyDrafts[provider]?.trim();
		if (!apiKey) return;
		try {
			const result = await setApiKeyMutation.mutateAsync({ provider, apiKey });
			queryClient.setQueryData(queryKeys.apiKeyStatus, { providers: result.providers });
			queryClient.setQueryData(queryKeys.appInfo, (current: any) =>
				current ? { ...current, modelStatus: result.modelStatus } : current,
			);
			dispatch({ type: "remove_api_key_draft", provider });
			const label = apiKeyProviders.find((entry) => entry.provider === provider)?.label ?? provider;
			toast.success(`Saved ${label} API key`);
		} catch (error) {
			toast.error(toErrorMessage(error));
		}
	};

	const handleRemoveApiKey = async (provider: string) => {
		try {
			const result = await removeApiKeyMutation.mutateAsync(provider);
			queryClient.setQueryData(queryKeys.apiKeyStatus, { providers: result.providers });
			queryClient.setQueryData(queryKeys.appInfo, (current: any) =>
				current ? { ...current, modelStatus: result.modelStatus } : current,
			);
			const label = apiKeyProviders.find((entry) => entry.provider === provider)?.label ?? provider;
			toast.success(`Removed ${label} API key`);
		} catch (error) {
			toast.error(toErrorMessage(error));
		}
	};

	const artifactCount = dashboard?.artifacts.length ?? 0;
	const needsWorkspaceSetup = (dashboard?.workspaces.length ?? 0) === 0;
	const modelStatus = appInfo?.modelStatus;
	const modelUnavailable = Boolean(modelStatus && !modelStatus.available);
	const composerBlockedReason = modelUnavailable
		? modelStatus?.error || "piwork could not load your available models."
		: undefined;
	const lastUserMessage = getLastUserMessage(activeChat);
	const canRetryLastPrompt = Boolean(activeChat && lastUserMessage && !state.pendingChatIds.includes(activeChat.id));

	const visibleChats = useMemo(
		() =>
			(dashboard?.chats ?? []).map((chat) =>
				state.pendingChatIds.includes(chat.id)
					? {
						...chat,
						status: "running" as const,
						messageCount: Math.max(chat.messageCount, 1),
						lastMessagePreview: chat.lastMessagePreview || "Working…",
					}
					: chat,
			),
		[dashboard?.chats, state.pendingChatIds],
	);

	const filteredVisibleChats = useMemo(
		() =>
			visibleChats.filter((chat) =>
				matchesQuery(state.chatSearchQuery, chat.title, chat.lastMessagePreview, chat.workspaceMentions.join(" ")),
			),
		[state.chatSearchQuery, visibleChats],
	);

	const draftChats = filteredVisibleChats.filter((chat) => chat.messageCount === 0 && chat.status !== "archived");

	const filteredArtifacts = useMemo(
		() =>
			filterArtifacts(dashboard?.artifacts ?? [], {
				artifactKindFilter: state.artifactKindFilter,
				artifactChatFilter: state.artifactChatFilter,
				artifactTagFilters: state.artifactTagFilters,
				artifactSearchQuery: state.artifactSearchQuery,
			}),
		[state.artifactChatFilter, state.artifactKindFilter, state.artifactSearchQuery, state.artifactTagFilters, dashboard?.artifacts],
	);

	const artifactTagCounts = useMemo(() => {
		const counts = new Map<string, number>();
		for (const artifact of dashboard?.artifacts ?? []) {
			for (const tag of artifact.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
		}
		return counts;
	}, [dashboard?.artifacts]);

	const orderedArtifactTags = useMemo(
		() =>
			[...(dashboard?.artifactTags ?? [])].sort((left, right) => {
				const countDiff = (artifactTagCounts.get(right) ?? 0) - (artifactTagCounts.get(left) ?? 0);
				return countDiff !== 0 ? countDiff : left.localeCompare(right);
			}),
		[artifactTagCounts, dashboard?.artifactTags],
	);

	const artifactLookup = useMemo(
		() => new Map((dashboard?.artifacts ?? []).map((artifact) => [artifact.id, artifact])),
		[dashboard?.artifacts],
	);

	const chatSections = useMemo(
		() =>
			CHAT_STATUS_ORDER.map((status) => ({
				status,
				label: CHAT_STATUS_LABELS[status],
				chats: filteredVisibleChats.filter((chat) => chat.messageCount > 0 && chat.status === status),
			})).filter((section) => section.chats.length > 0 || section.status === "archived"),
		[filteredVisibleChats],
	);

	const activeRuntimeActivity = state.activeChatId ? state.runtimeActivityByChatId[state.activeChatId] : undefined;

	const isBooting =
		bridgeAvailable &&
		(!state.initialized || isInitializing || dashboardQuery.isLoading || appInfoQuery.isLoading || apiKeyStatusQuery.isLoading);

	return {
		bridgeAvailable,
		isBooting,
		dashboard,
		appInfo,
		apiKeyProviders,
		activeChat,
		activeArtifact,
		artifactModal,
		state,
		artifactCount,
		needsWorkspaceSetup,
		modelStatus,
		modelUnavailable,
		composerBlockedReason,
		canRetryLastPrompt,
		visibleChats,
		filteredVisibleChats,
		draftChats,
		filteredArtifacts,
		artifactTagCounts,
		orderedArtifactTags,
		artifactLookup,
		chatSections,
		activeRuntimeActivity,
		handleCreateChat,
		openChatById,
		refreshDashboard,
		refreshAppInfo,
		handleSelectedModelChange,
		handleCancelActiveRun,
		handleRetryLastPrompt,
		handleComposerSubmit,
		handleOpenArtifact,
		handleAddWorkspace,
		handleOpenPiworkFolder,
		handleSaveWorkspace,
		handleRemoveWorkspace,
		handleCheckForUpdates,
		handleDownloadUpdate,
		handleApplyUpdate,
		handleSetSemanticSearchEnabled,
		handleArchiveChat,
		handleArchiveCompletedChats,
		handleDeleteChat,
		handleSaveArtifactTags,
		handleSaveApiKey,
		handleRemoveApiKey,
		selectChat: openChatById,
		setActiveView: (value: any) => dispatch({ type: "set_active_view", value }),
		setArtifactModalId: (value: string | null) => dispatch({ type: "set_artifact_modal_id", value }),
		setActiveArtifactId: (value: string | null) => dispatch({ type: "set_active_artifact_id", value }),
		setChatSearchQuery: (value: string) => dispatch({ type: "set_chat_search_query", value }),
		setArtifactSearchQuery: (value: string) => dispatch({ type: "set_artifact_search_query", value }),
		toggleSidebarSection: (key: any) => dispatch({ type: "toggle_sidebar_section", key }),
		setArtifactKindFilter: (value: any) => dispatch({ type: "set_artifact_kind_filter", value }),
		setArtifactChatFilter: (value: string) => dispatch({ type: "set_artifact_chat_filter", value }),
		setArtifactTagTrayOpen: (value: boolean) => dispatch({ type: "set_artifact_tag_tray_open", value }),
		setArtifactShowAllTags: (value: boolean) => dispatch({ type: "set_artifact_show_all_tags", value }),
		clearArtifactFilters: () => dispatch({ type: "clear_artifact_filters" }),
		toggleArtifactTagFilter: (tag: string) =>
			dispatch({
				type: "set_artifact_tag_filters",
				value: state.artifactTagFilters.includes(tag)
					? state.artifactTagFilters.filter((entry) => entry !== tag)
					: [...state.artifactTagFilters, tag].sort((left, right) => left.localeCompare(right)),
			}),
		setWorkspaceDraft: (workspaceId: string, value: string) =>
			dispatch({ type: "patch_workspace_draft", workspaceId, value }),
		setApiKeyDraft: (provider: string, value: string) =>
			dispatch({ type: "patch_api_key_draft", provider, value }),
	};
}
