import {
	createAgentSession,
	SessionManager,
	type CustomTool,
	type ModelRegistry,
} from "@oh-my-pi/pi-coding-agent";
import type { ImageContent } from "@oh-my-pi/pi-ai";
import { Effect, Schema } from "effect";
import type { OmpErrorCode, OmpStreamEvent } from "./view-rpc";

const LOG = "[piwork:omp]";
const DEFAULT_TIMEOUT_MS = 120_000;
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_ATTACHMENT_BYTES = 20 * 1024 * 1024;

export const OmpPromptRequestSchema = Schema.Struct({
	runId: Schema.String,
	threadId: Schema.String,
	prompt: Schema.String,
});

export type OmpPromptRequest = Schema.Schema.Type<typeof OmpPromptRequestSchema>;

const decodeOmpPromptRequest = Schema.decodeUnknownSync(OmpPromptRequestSchema);

export const OmpPromptResponseSchema = Schema.Struct({
	runId: Schema.String,
	threadId: Schema.String,
	selectedModel: Schema.String,
	modelFallbackMessage: Schema.String,
	output: Schema.String,
	durationMs: Schema.Number,
	tokensIn: Schema.optional(Schema.Number),
	tokensOut: Schema.optional(Schema.Number),
	cost: Schema.optional(Schema.Number),
});

export type OmpPromptResponse = Schema.Schema.Type<typeof OmpPromptResponseSchema>;

const decodeOmpPromptResponse = Schema.decodeUnknownSync(OmpPromptResponseSchema);

const MIME_TYPES: Record<string, string> = {
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".gif": "image/gif",
	".webp": "image/webp",
};

const getMimeType = (path: string): string => {
	const dotIndex = path.lastIndexOf(".");
	const ext = dotIndex >= 0 ? path.slice(dotIndex).toLowerCase() : "";
	return MIME_TYPES[ext] ?? "application/octet-stream";
};

const loadImageAttachments = async (paths: string[]): Promise<ImageContent[]> => {
	const images: ImageContent[] = [];
	let totalBytes = 0;
	for (const filePath of paths) {
		const file = Bun.file(filePath);
		if (!(await file.exists())) {
			throw new Error(`Attachment not found: ${filePath}`);
		}
		const mimeType = getMimeType(filePath);
		if (mimeType === "application/octet-stream") {
			throw new Error(`Unsupported attachment type: ${filePath}`);
		}
		const size = file.size;
		if (size <= 0) {
			throw new Error(`Attachment is empty: ${filePath}`);
		}
		if (size > MAX_ATTACHMENT_BYTES) {
			throw new Error(
				`Attachment too large (${Math.ceil(size / 1024 / 1024)}MB): ${filePath}. Max per file is ${Math.floor(MAX_ATTACHMENT_BYTES / 1024 / 1024)}MB.`,
			);
		}
		totalBytes += size;
		if (totalBytes > MAX_TOTAL_ATTACHMENT_BYTES) {
			throw new Error(
				`Attachments exceed total limit (${Math.ceil(totalBytes / 1024 / 1024)}MB). Max total is ${Math.floor(MAX_TOTAL_ATTACHMENT_BYTES / 1024 / 1024)}MB.`,
			);
		}
		const buffer = await file.arrayBuffer();
		const data = Buffer.from(buffer).toString("base64");
		images.push({ type: "image", data, mimeType });
	}
	return images;
};

const formatUnknownError = (error: unknown): string =>
	error instanceof Error ? error.message : String(error);

const formatModelName = (model: { provider: string; id: string } | undefined): string =>
	model ? `${model.provider}/${model.id}` : "none";

const extractAssistantText = (message: unknown): string => {
	if (!message || typeof message !== "object") return "";
	const maybeAssistant = message as { role?: string; content?: Array<{ type?: string; text?: string }> };
	if (maybeAssistant.role !== "assistant" || !Array.isArray(maybeAssistant.content)) return "";
	const textBlocks = maybeAssistant.content
		.filter((item): item is { type: "text"; text: string } => item.type === "text" && typeof item.text === "string")
		.map((item) => item.text.trim())
		.filter((item) => item.length > 0);
	return textBlocks.join("\n").trim();
};

const stringifyRuntimePayload = (payload: unknown): string => {
	try {
		const json = JSON.stringify(payload);
		return json.length > 220 ? `${json.slice(0, 220)}…` : json;
	} catch {
		return "unserializable tool payload";
	}
};

const classifyOmpError = (message: string): OmpErrorCode => {
	const normalized = message.toLowerCase();
	if (normalized.includes("timed out")) return "prompt_timeout";
	if (normalized.includes("empty response")) return "empty_output";
	if (normalized.includes("attachment")) return "attachment_validation_error";
	if (normalized.includes("model")) return "model_resolution_failure";
	if (normalized.includes("tool")) return "tool_execution_error";
	if (normalized.includes("stream") || normalized.includes("subscribe")) return "stream_interruption";
	return "runtime_error";
};

const promptWithTimeout = async (
	prompt: Promise<void>,
	onTimeout: () => void,
	timeoutMs: number,
): Promise<void> => {
	let timeoutId: ReturnType<typeof setTimeout> | undefined;

	try {
		await Promise.race([
			prompt,
			new Promise<never>((_, reject) => {
				timeoutId = setTimeout(() => {
					onTimeout();
					reject(new Error(`OMP prompt timed out after ${timeoutMs}ms`));
				}, timeoutMs);
			}),
		]);
	} finally {
		if (timeoutId !== undefined) {
			clearTimeout(timeoutId);
		}
	}
};

const createDeltaThrottle = (
	emit: (delta: string) => void,
	intervalMs = 200,
) => {
	let buffer = "";
	let timer: ReturnType<typeof setTimeout> | undefined;
	return {
		push(delta: string) {
			buffer += delta;
			if (timer !== undefined) return;
			timer = setTimeout(() => {
				timer = undefined;
				if (buffer) { const b = buffer; buffer = ""; emit(b); }
			}, intervalMs);
		},
		flush() {
			if (timer !== undefined) { clearTimeout(timer); timer = undefined; }
			if (buffer) { const b = buffer; buffer = ""; emit(b); }
		},
	};
};

export interface OmpPromptOptions {
	sessionDir?: string;
	cwd?: string;
	timeoutMs?: number;
	allowEmptyResponse?: boolean;
	customTools?: CustomTool<any, any>[];
	onEvent?: (event: OmpStreamEvent) => void;
	modelId?: string;
	attachmentPaths?: string[];
	modelRegistry?: ModelRegistry;
	systemPrompt?: string;
	abortSignal?: AbortSignal;
}

export const runOmpPrompt = (
	input: OmpPromptRequest,
	customTools?: CustomTool<any, any>[],
	options?: OmpPromptOptions,
) =>
	Effect.tryPromise({
		try: async () => {
			const request = decodeOmpPromptRequest(input);
			const runLabel = request.runId.slice(0, 8);
			const startedAt = Date.now();
			const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

			// --- Session creation ---
			const effectiveCwd = options?.cwd ?? process.cwd();
			const sessionManager = options?.sessionDir
				? await SessionManager.continueRecent(effectiveCwd, options.sessionDir)
				: SessionManager.inMemory();

			// --- Resolve model if specified ---
			let resolvedModel: { provider: string; id: string } | undefined;
			if (options?.modelId && options?.modelRegistry) {
				const [provider, ...rest] = options.modelId.split("/");
				const modelId = rest.join("/");
				resolvedModel = options.modelRegistry.find(provider, modelId) as any;
				if (resolvedModel) {
					console.log(`${LOG} resolved model: ${provider}/${modelId}`);
				} else {
					console.warn(`${LOG} model not found: ${options.modelId}, falling back to auto`);
				}
			}

				const mergedTools = [...(customTools ?? []), ...(options?.customTools ?? [])];

				const { session, modelFallbackMessage } = await createAgentSession({
				sessionManager,
				customTools: mergedTools,
				...(resolvedModel && { model: resolvedModel as any }),
				...(options?.modelRegistry && { modelRegistry: options.modelRegistry }),
				...(options?.systemPrompt && { systemPrompt: options.systemPrompt }),
			});

			const selectedModel = formatModelName(session.model);

			// --- Log model selection ---
			console.log(`${LOG}[${runLabel}] model=${selectedModel}`);
			if (modelFallbackMessage && modelFallbackMessage.length > 0) {
				console.warn(`${LOG}[${runLabel}] model fallback: ${modelFallbackMessage}`);
			}
			try {
				const toolNames = session.getActiveToolNames();
				console.log(`${LOG}[${runLabel}] tools=[${toolNames.join(", ")}]`);
			} catch {
				// getActiveToolNames may not be available in all versions
			}

			// --- Subscribe to events ---
			let output = "";
			let latestAssistantText = "";
			const toolTimers = new Map<string, number>();
			const emitEvent = options?.onEvent;
			const deltaThrottle = createDeltaThrottle((delta) => {
				emitEvent?.({ type: "assistant_text_delta", threadId: request.threadId, delta });
			});

				const unsubscribe = session.subscribe((event) => {
				switch (event.type) {
					case "message_update":
						latestAssistantText = extractAssistantText(event.message) || latestAssistantText;
						switch (event.assistantMessageEvent.type) {
							case "text_delta":
								output += event.assistantMessageEvent.delta;
								deltaThrottle.push(event.assistantMessageEvent.delta);
								break;
							case "thinking_delta":
							case "toolcall_start":
							case "toolcall_delta":
							case "toolcall_end":
								break;
							case "error": {
								const message = event.assistantMessageEvent.error.errorMessage ?? "Assistant stream error";
								emitEvent?.({
									type: "error",
									threadId: request.threadId,
									message,
									code: classifyOmpError(message),
								});
								break;
							}
						}
						break;
					case "turn_start":
						console.log(`${LOG}[${runLabel}] turn started`);
						emitEvent?.({ type: "turn_start", threadId: request.threadId });
						break;
					case "turn_end":
						console.log(`${LOG}[${runLabel}] turn ended`);
						latestAssistantText = extractAssistantText(event.message) || latestAssistantText;
						deltaThrottle.flush();
						emitEvent?.({ type: "turn_end", threadId: request.threadId });
						break;
					case "tool_execution_start":
						toolTimers.set(event.toolCallId, Date.now());
						console.log(`${LOG}[${runLabel}] tool_start: ${event.toolName}`);
						emitEvent?.({ type: "tool_start", threadId: request.threadId, toolCallId: event.toolCallId, toolName: event.toolName });
						break;
					case "tool_execution_update":
						emitEvent?.({ type: "tool_update", threadId: request.threadId, toolCallId: event.toolCallId, toolName: event.toolName, detail: stringifyRuntimePayload(event.update) });
						break;
					case "tool_execution_end": {
						const started = toolTimers.get(event.toolCallId);
						const elapsed = started ? Date.now() - started : undefined;
						toolTimers.delete(event.toolCallId);
						console.log(
							`${LOG}[${runLabel}] tool_end: ${event.toolName}${elapsed !== undefined ? ` (${elapsed}ms)` : ""}`,
						);
						emitEvent?.({ type: "tool_end", threadId: request.threadId, toolCallId: event.toolCallId, toolName: event.toolName, isError: event.isError });
						if (event.isError) {
							const message = `Tool ${event.toolName} failed: ${stringifyRuntimePayload(event.result)}`;
							emitEvent?.({
								type: "error",
								threadId: request.threadId,
								message,
								code: "tool_execution_error",
							});
						}
						break;
					}
					case "auto_compaction_start":
						console.log(`${LOG}[${runLabel}] compaction started (reason=${event.reason})`);
						break;
					case "auto_compaction_end":
						console.log(
							`${LOG}[${runLabel}] compaction ended (aborted=${event.aborted}, willRetry=${event.willRetry})`,
						);
						break;
					case "auto_retry_start":
						console.warn(
							`${LOG}[${runLabel}] retry ${event.attempt}/${event.maxAttempts} in ${event.delayMs}ms: ${event.errorMessage}`,
						);
						break;
					case "auto_retry_end":
						console.log(
							`${LOG}[${runLabel}] retry ended (success=${event.success}, attempt=${event.attempt})`,
						);
						break;
				}
			});

				let abortListener: (() => void) | undefined;
				try {
					if (options?.abortSignal?.aborted) {
						throw new Error("OMP prompt canceled by user.");
					}
					abortListener = () => {
						session.abort();
					};
					options?.abortSignal?.addEventListener("abort", abortListener, { once: true });
					if (!session.model) {
						throw new Error(
							modelFallbackMessage && modelFallbackMessage.length > 0
								? modelFallbackMessage
								: "No model selected in OMP. Configure API credentials and select a model.",
					);
				}

				// --- Load image attachments ---
				let images: ImageContent[] | undefined;
				if (options?.attachmentPaths && options.attachmentPaths.length > 0) {
					images = await loadImageAttachments(options.attachmentPaths);
					console.log(`${LOG}[${runLabel}] loaded ${images.length} image attachment(s)`);
				}

					await promptWithTimeout(
						session.prompt(request.prompt, { expandPromptTemplates: false, ...(images && { images }) }),
						() => {
							session.abort();
						},
						timeoutMs,
					);
					if (abortListener) {
						options?.abortSignal?.removeEventListener("abort", abortListener);
					}

				const text = (output.trim() || latestAssistantText.trim()).trim();
				let finalText = text;
				if (finalText.length === 0) {
					if (options?.allowEmptyResponse) {
						console.warn(`${LOG}[${runLabel}] empty assistant text allowed by caller`);
					} else {
						throw new Error("OMP returned an empty response.");
					}
				}

				const durationMs = Date.now() - startedAt;

				// --- Log session stats ---
				let tokensIn: number | undefined;
				let tokensOut: number | undefined;
				let cost: number | undefined;
				try {
					const stats = session.getSessionStats();
					tokensIn = stats.tokens.input;
					tokensOut = stats.tokens.output;
					cost = stats.cost;
					console.log(
						`${LOG}[${runLabel}] stats: in=${stats.tokens.input} out=${stats.tokens.output} cache_read=${stats.tokens.cacheRead} cache_write=${stats.tokens.cacheWrite} total=${stats.tokens.total} cost=$${stats.cost.toFixed(4)} tool_calls=${stats.toolCalls} messages=${stats.totalMessages}`,
					);
				} catch {
					// stats not available
				}

				// --- Log context usage ---
				try {
					const ctx = session.getContextUsage();
					if (ctx) {
						console.log(
							`${LOG}[${runLabel}] context: ${ctx.percent !== null ? `${ctx.percent.toFixed(1)}%` : "?%"} of ${ctx.contextWindow} tokens`,
						);
					}
				} catch {
					// context usage not available
				}

				console.log(`${LOG}[${runLabel}] done in ${durationMs}ms`);

				return decodeOmpPromptResponse({
					runId: request.runId,
					threadId: request.threadId,
					selectedModel,
					modelFallbackMessage: modelFallbackMessage ?? "",
					output: finalText,
					durationMs,
					tokensIn,
					tokensOut,
					cost,
				});
				} catch (error) {
					const message = formatUnknownError(error);
				emitEvent?.({
					type: "error",
					threadId: request.threadId,
					message,
					code: classifyOmpError(message),
				});
				throw error;
				} finally {
					deltaThrottle.flush();
					if (abortListener) {
						options?.abortSignal?.removeEventListener("abort", abortListener);
					}
					unsubscribe();
					await session.dispose();
				}
		},
		catch: (error) => new Error(`OMP prompt failed: ${formatUnknownError(error)}`),
	});
