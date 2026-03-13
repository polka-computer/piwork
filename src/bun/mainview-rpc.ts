import { BrowserView, Updater, Utils } from "electrobun/bun";
import { dirname } from "node:path";
import type { AppInfo, ModelStatus, PiworkViewRPCSchema } from "../shared/view-rpc";
import { getModelStatus, listApiKeyProviders, removeProviderApiKey, setProviderApiKey } from "./model-registry";
import { PIWORK_ROOT_DIR } from "./piwork-paths";
import * as store from "./piwork-store";
import type { ChatRunner } from "./chat-runner";

export const createMainviewRpc = (options: {
	getAppInfo: () => Promise<AppInfo>;
	reinitializeQmd: () => Promise<void>;
	chatRunner: ChatRunner;
}) =>
	BrowserView.defineRPC<PiworkViewRPCSchema>({
		maxRequestTime: 10 * 60 * 1000,
		handlers: {
			requests: {
				getDashboardState: async () => store.getDashboardState(),

				getAppInfo: async () => options.getAppInfo(),

				getChat: async ({ id }) => store.getChat(id),

				createChat: async ({ title }) => store.createChat(title),

				sendChatMessage: async ({ chatId, content, modelId, attachmentPaths, mentionedArtifactIds }) =>
					options.chatRunner.runChatMessage({
						chatId,
						content,
						modelId,
						attachmentPaths,
						mentionedArtifactIds,
					}),

				getArtifact: async ({ id }) => store.getArtifact(id),

				updateArtifact: async ({ artifactId, title, content, tags }) => {
					// Guard: drop content param for image artifacts
					const existing = await store.getArtifact(artifactId);
					const safeContent = existing.kind === "image" ? undefined : content;
					await store.updateArtifact({ artifactId, title, content: safeContent, tags });
					return {
						artifact: await store.getArtifact(artifactId),
						dashboard: await store.getDashboardState(),
					};
				},

				setSelectedModel: async ({ modelId }) => {
					await store.setSelectedModel(modelId);
					return store.getDashboardState();
				},

				setSemanticSearchEnabled: async ({ enabled }) => {
					await store.setSemanticSearchEnabled(enabled);
					await options.reinitializeQmd();
					return options.getAppInfo();
				},

				showArtifactInFinder: async ({ artifactId }) => {
					const artifact = await store.getArtifact(artifactId);
					await Utils.openPath(dirname(artifact.path));
					return { ok: true as const };
				},

				openPiworkFolder: async () => {
					await Utils.openPath(PIWORK_ROOT_DIR);
					return { ok: true as const };
				},

				pickWorkspaceFolder: async () => {
					const paths = await Utils.openFileDialog({
						canChooseFiles: false,
						canChooseDirectory: true,
						allowsMultipleSelection: true,
					});
					return { paths: paths.filter(Boolean) };
				},

				addWorkspace: async ({ path, alias }) => {
					await store.addWorkspace(path, alias);
					await options.reinitializeQmd();
					return store.getDashboardState();
				},

				renameWorkspace: async ({ workspaceId, alias }) => {
					await store.renameWorkspace(workspaceId, alias);
					await options.reinitializeQmd();
					return store.getDashboardState();
				},

				removeWorkspace: async ({ workspaceId }) => {
					await store.removeWorkspace(workspaceId);
					await options.reinitializeQmd();
					return store.getDashboardState();
				},

				archiveChat: async ({ chatId, archived }) => {
					await store.archiveChat(chatId, archived);
					return store.getDashboardState();
				},

				markChatReviewed: async ({ chatId }) => {
					await store.markChatReviewed(chatId);
					return store.getDashboardState();
				},

				deleteChat: async ({ chatId }) => {
					await store.deleteChat(chatId);
					return store.getDashboardState();
				},

				getAvailableModels: async () => {
					const modelStatus: ModelStatus = await getModelStatus();
					return {
						models: modelStatus.models,
						error: modelStatus.error,
					};
				},

				getApiKeyStatus: async () => ({
					providers: await listApiKeyProviders(),
				}),

				setApiKey: async ({ provider, apiKey }) => {
					await setProviderApiKey(provider, apiKey);
					return {
						providers: await listApiKeyProviders(),
						modelStatus: await getModelStatus(true),
					};
				},

				removeApiKey: async ({ provider }) => {
					await removeProviderApiKey(provider);
					return {
						providers: await listApiKeyProviders(),
						modelStatus: await getModelStatus(true),
					};
				},

				pickFiles: async () => {
					const paths = await Utils.openFileDialog({
						canChooseFiles: true,
						canChooseDirectory: false,
						allowsMultipleSelection: true,
					});
					return { paths: paths.filter(Boolean) };
				},

				cancelActiveRun: async ({ chatId }) => options.chatRunner.cancelActiveRun(chatId),

				retryLastMessage: async ({ chatId }) => {
					const lastUserMessage = await store.getLatestUserMessage(chatId);
					if (!lastUserMessage) {
						throw new Error("There is no user message to retry in this chat.");
					}
					return options.chatRunner.runChatMessage({
						chatId,
						content: lastUserMessage.content,
						modelId: lastUserMessage.meta?.selectedModel,
						mentionedArtifactIds: lastUserMessage.artifactIds,
					});
				},

				checkForUpdate: async () => {
					Updater.clearStatusHistory?.();
					await Updater.checkForUpdate();
					return options.getAppInfo();
				},

				downloadUpdate: async () => {
					Updater.clearStatusHistory?.();
					await Updater.downloadUpdate();
					return options.getAppInfo();
				},

				applyUpdate: async () => {
					await Updater.applyUpdate();
					return { ok: true as const };
				},
			},
			messages: {},
		},
	});
