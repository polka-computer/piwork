import { join } from "node:path";
import type { ChatCommandResponse, ChatMessage, OmpStreamEvent } from "../shared/view-rpc";
import { ulid } from "../shared/ulid";
import { buildSystemPrompt } from "./build-system-prompt";
import { getModelRegistry } from "./model-registry";
import { PIWORK_ROOT_DIR, PIWORK_SESSIONS_DIR } from "./piwork-paths";
import {
	createPiworkArtifactsTool,
	piworkHomeTool,
	piworkResourcesTool,
} from "./piwork-tools";
import * as store from "./piwork-store";
import { createQmdSearchTool } from "./qmd-tool";
import { createReplicateTool } from "./replicate-tool";
import type { QmdManager } from "./qmd-manager";
import { getRuntimeAdapter } from "./runtime";

const runtime = getRuntimeAdapter();

export interface PendingRunInput {
	chatId: string;
	content: string;
	modelId?: string;
	attachmentPaths?: string[];
	mentionedArtifactIds?: string[];
}

export interface ChatRunner {
	runChatMessage: (input: PendingRunInput) => Promise<ChatCommandResponse>;
	cancelActiveRun: (chatId: string) => Promise<ChatCommandResponse>;
}

const isAbortError = (error: unknown): boolean => {
	const message = error instanceof Error ? error.message : String(error);
	return /abort|cancel/i.test(message);
};

export const createChatRunner = (options: {
	qmdManager: QmdManager;
	sendOmpEvent: (event: OmpStreamEvent) => void;
}): ChatRunner => {
	const activeRunsByChatId = new Map<string, ReturnType<typeof runtime.startRun>>();

	const runChatMessage = async ({
		chatId,
		content,
		modelId,
		attachmentPaths,
		mentionedArtifactIds,
	}: PendingRunInput): Promise<ChatCommandResponse> => {
		const trimmed = content.trim();
		if (!trimmed) throw new Error("Message cannot be empty.");
		if (activeRunsByChatId.has(chatId)) {
			throw new Error("A run is already active for this chat.");
		}

		const mentionedAliases = await store.getMentionedWorkspaceAliases(trimmed);
		const referencedArtifactIds = Array.from(
			new Set((mentionedArtifactIds ?? []).map((id) => id.trim()).filter(Boolean)),
		);
		const userMessage: ChatMessage = {
			id: ulid(),
			role: "user",
			content: trimmed,
			createdAt: new Date().toISOString(),
			workspaceMentions: mentionedAliases,
			artifactIds: referencedArtifactIds,
			meta: {
				selectedModel: modelId,
			},
		};
		await store.appendChatMessage(chatId, userMessage);
		const touchedArtifactIds: string[] = [];
		const createdArtifactIds: string[] = [];
		const noteArtifactWrite = (artifactId: string, action: "create" | "update") => {
			if (!touchedArtifactIds.includes(artifactId)) touchedArtifactIds.push(artifactId);
			if (action === "create" && !createdArtifactIds.includes(artifactId)) {
				createdArtifactIds.push(artifactId);
			}
		};

		try {
			const [workspaces, workspaceContext, artifactContext, registry] = await Promise.all([
				store.listWorkspaces(),
				store.buildWorkspacePromptContext(mentionedAliases),
				store.buildArtifactPromptContext(referencedArtifactIds),
				getModelRegistry(),
			]);
			const existingArtifactTags = await store.listArtifactTags();
			const sessionKey = await store.getChatSessionKey(chatId);
			const handle = runtime.startRun(
				{
					runId: `piwork-${chatId}-${Date.now()}`,
					threadId: chatId,
					prompt: [
						"Workspace context:",
						workspaceContext,
						"",
						"Referenced artifacts:",
						artifactContext,
						"",
						"User request:",
						trimmed,
					].join("\n"),
				},
				{
					sessionDir: join(PIWORK_SESSIONS_DIR, chatId, sessionKey),
					cwd: PIWORK_ROOT_DIR,
					allowEmptyResponse: true,
					timeoutMs: 300_000,
					modelRegistry: registry,
					modelId,
					attachmentPaths,
					systemPrompt: buildSystemPrompt(workspaces, mentionedAliases, existingArtifactTags, { qmdAvailable: options.qmdManager.isAvailable() }),
					onEvent: options.sendOmpEvent,
					customTools: [
						piworkResourcesTool,
						piworkHomeTool,
						createPiworkArtifactsTool(chatId, {
							onArtifactWrite: noteArtifactWrite,
						}),
						...(options.qmdManager.isAvailable() ? [createQmdSearchTool(options.qmdManager)] : []),
						...(process.env.REPLICATE_API_TOKEN ? [createReplicateTool(chatId, { onArtifactWrite: noteArtifactWrite })] : []),
					],
				},
			);
			activeRunsByChatId.set(chatId, handle);
			const result = await handle.promise;
			const assistantMessageId = ulid();
			await store.associateArtifactsWithChat({
				chatId,
				artifactIds: touchedArtifactIds,
			});
			await store.finalizeCreatedArtifactsForMessage({
				chatId,
				messageId: assistantMessageId,
				artifactIds: createdArtifactIds,
			});
			const assistantMessage: ChatMessage = {
				id: assistantMessageId,
				role: "assistant",
				content: result.output.trim() || (touchedArtifactIds.length > 0 ? "Updated the requested artifacts." : "Done."),
				createdAt: new Date().toISOString(),
				workspaceMentions: mentionedAliases,
				artifactIds: touchedArtifactIds,
				meta: {
					selectedModel: result.selectedModel,
					durationMs: result.durationMs,
				},
			};
			await store.appendChatMessage(chatId, assistantMessage);
		} catch (error) {
			const aborted = isAbortError(error);
			const message = aborted ? "Canceled this run." : error instanceof Error ? error.message : String(error);
			const assistantMessageId = ulid();
			await store.associateArtifactsWithChat({
				chatId,
				artifactIds: touchedArtifactIds,
			});
			await store.finalizeCreatedArtifactsForMessage({
				chatId,
				messageId: assistantMessageId,
				artifactIds: createdArtifactIds,
			});
			await store.appendChatMessage(chatId, {
				id: assistantMessageId,
				role: "assistant",
				content: aborted ? "Canceled this run." : `I hit an error while working on that.\n\n${message}`,
				createdAt: new Date().toISOString(),
				workspaceMentions: mentionedAliases,
				artifactIds: touchedArtifactIds,
				meta: aborted ? undefined : { errorMessage: message },
			});
			if (!aborted) {
				options.sendOmpEvent({
					type: "error",
					threadId: chatId,
					message,
					code: "runtime_error",
				});
			}
		} finally {
			activeRunsByChatId.delete(chatId);
			options.sendOmpEvent({ type: "turn_end", threadId: chatId });
		}

		return {
			chat: await store.getChat(chatId),
			dashboard: await store.getDashboardState(),
		};
	};

	const cancelActiveRun = async (chatId: string): Promise<ChatCommandResponse> => {
		const handle = activeRunsByChatId.get(chatId);
		if (handle) {
			handle.cancel();
			for (let attempts = 0; attempts < 40; attempts += 1) {
				if (!activeRunsByChatId.has(chatId)) break;
				await Bun.sleep(50);
			}
		}
		return {
			chat: await store.getChat(chatId),
			dashboard: await store.getDashboardState(),
		};
	};

	return {
		runChatMessage,
		cancelActiveRun,
	};
};
