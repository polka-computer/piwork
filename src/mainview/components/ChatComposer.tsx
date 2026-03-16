import { createPortal } from "react-dom";
import { type FormEvent, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import type {
	ArtifactSummary,
	AvailableModel,
	WorkspaceSummary,
} from "../../shared/view-rpc";
import { getAvailableModelsViaBun, hasBunBridge, pickFilesViaBun, writeTempFileViaBun } from "../rpc";

export interface ComposerSubmitInput {
	prompt: string;
	modelId?: string;
	attachmentPaths?: string[];
	mentionedArtifactIds?: string[];
}

export interface ComposerSubmitResult {
	statusText?: string;
	modelFallbackMessage?: string;
}

interface Attachment {
	path: string;
	name: string;
}

interface ChatComposerProps {
	placeholder?: string;
	submitLabel?: string;
	defaultModelId?: string;
	workspaces?: WorkspaceSummary[];
	artifacts?: ArtifactSummary[];
	autoFocus?: boolean;
	focusToken?: number;
	disabled?: boolean;
	disabledReason?: string;
	isBusy?: boolean;
	onSubmit: (input: ComposerSubmitInput) => Promise<ComposerSubmitResult | void>;
	onModelChange?: (modelId?: string) => void;
	className?: string;
}

interface PromptSelection {
	start: number;
	end: number;
}

const basename = (path: string): string => {
	const parts = path.split("/");
	return parts[parts.length - 1] ?? path;
};

const previewText = (text: string, max = 72): string =>
	text.length <= max ? text : `${text.slice(0, max - 1)}…`;

const formatRelativeTime = (dateStr: string): string => {
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
	return `${Math.floor(diffDays / 30)}mo`;
};

export default function ChatComposer({
	placeholder = "What should we build?",
	submitLabel = "Send",
	defaultModelId,
	workspaces = [],
	artifacts = [],
	autoFocus = false,
	focusToken,
	disabled = false,
	disabledReason,
	isBusy = false,
	onSubmit,
	onModelChange,
	className,
}: ChatComposerProps) {
	const [prompt, setPrompt] = useState("");
	const [models, setModels] = useState<AvailableModel[]>([]);
	const [modelId, setModelId] = useState<string | undefined>(defaultModelId);
	const [modelPickerOpen, setModelPickerOpen] = useState(false);
	const [modelQuery, setModelQuery] = useState("");
	const [mentionPickerOpen, setMentionPickerOpen] = useState(false);
	const [mentionQuery, setMentionQuery] = useState("");
	const [attachments, setAttachments] = useState<Attachment[]>([]);
	const [isDragOver, setIsDragOver] = useState(false);
	const [mentionedArtifacts, setMentionedArtifacts] = useState<ArtifactSummary[]>([]);
	const [modelLoadError, setModelLoadError] = useState<string | undefined>();
	const [mentionSelectedIndex, setMentionSelectedIndex] = useState(0);
	const promptRef = useRef<HTMLTextAreaElement>(null);
	const pickerRef = useRef<HTMLDivElement>(null);
	const pickerInputRef = useRef<HTMLInputElement>(null);
	const mentionPickerRef = useRef<HTMLDivElement>(null);
	const mentionInputRef = useRef<HTMLInputElement>(null);
	const mentionSelectionRef = useRef<PromptSelection>({ start: 0, end: 0 });
	const deferredModelQuery = useDeferredValue(modelQuery);
	const deferredMentionQuery = useDeferredValue(mentionQuery);

	useEffect(() => {
		if (!hasBunBridge()) return;
		getAvailableModelsViaBun()
			.then(({ models, error }) => {
				setModels(models);
				setModelLoadError(error);
			})
			.catch((error) => {
				setModelLoadError(error instanceof Error ? error.message : String(error));
			});
	}, []);

	useEffect(() => {
		if (!modelPickerOpen) return;
		const handler = (event: MouseEvent) => {
			if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
				setModelPickerOpen(false);
			}
		};
		const handleKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") setModelPickerOpen(false);
		};
		document.addEventListener("mousedown", handler);
		document.addEventListener("keydown", handleKey);
		return () => {
			document.removeEventListener("mousedown", handler);
			document.removeEventListener("keydown", handleKey);
		};
	}, [modelPickerOpen]);

	const selectMentionItem = (item: MentionItem) => {
		if (item.type === "workspace") {
			insertWorkspaceMention(item.workspace.alias);
		} else {
			addMentionedArtifact(item.artifact);
		}
	};

	const handleMentionKeyDown = (event: React.KeyboardEvent) => {
		switch (event.key) {
			case "ArrowDown":
				event.preventDefault();
				setMentionSelectedIndex((i) => Math.min(i + 1, mentionItems.length - 1));
				break;
			case "ArrowUp":
				event.preventDefault();
				setMentionSelectedIndex((i) => Math.max(i - 1, 0));
				break;
			case "Enter":
				event.preventDefault();
				if (clampedIndex >= 0 && mentionItems[clampedIndex]) {
					selectMentionItem(mentionItems[clampedIndex]);
				}
				break;
			case "Escape":
				event.preventDefault();
				setMentionPickerOpen(false);
				break;
		}
	};

	useEffect(() => {
		if (!modelPickerOpen) return;
		setModelQuery("");
		queueMicrotask(() => pickerInputRef.current?.focus());
	}, [modelPickerOpen]);

	useEffect(() => {
		if (!mentionPickerOpen) return;
		setMentionQuery("");
		setMentionSelectedIndex(0);
		queueMicrotask(() => mentionInputRef.current?.focus());
	}, [mentionPickerOpen]);

	useEffect(() => {
		setModelId(defaultModelId);
	}, [defaultModelId]);

	useEffect(() => {
		if (!autoFocus || isBusy) return;
		queueMicrotask(() => {
			promptRef.current?.focus();
			const length = promptRef.current?.value.length ?? 0;
			promptRef.current?.setSelectionRange(length, length);
		});
	}, [autoFocus, isBusy]);

	useEffect(() => {
		if (focusToken === undefined || isBusy) return;
		queueMicrotask(() => {
			promptRef.current?.focus();
			const length = promptRef.current?.value.length ?? 0;
			promptRef.current?.setSelectionRange(length, length);
		});
	}, [focusToken, isBusy]);

	useEffect(() => {
		setMentionSelectedIndex(0);
	}, [deferredMentionQuery]);

	const selectedModelLabel = useMemo(() => {
		if (!modelId) return "Auto";
		const model = models.find((entry) => `${entry.provider}/${entry.id}` === modelId);
		return model ? model.name : modelId;
	}, [modelId, models]);

	const filteredModels = useMemo(() => {
		const query = deferredModelQuery.trim().toLowerCase();
		const sorted = [...models].sort((left, right) => {
			const providerCompare = left.provider.localeCompare(right.provider);
			if (providerCompare !== 0) return providerCompare;
			return left.name.localeCompare(right.name);
		});
		if (!query) return sorted;
		return sorted.filter((model) =>
			`${model.provider} ${model.name} ${model.id}`.toLowerCase().includes(query),
		);
	}, [deferredModelQuery, models]);

	const filteredWorkspaces = useMemo(() => {
		const query = deferredMentionQuery.trim().toLowerCase();
		if (!query) return workspaces;
		return workspaces.filter((workspace) =>
			`${workspace.alias} ${workspace.path}`.toLowerCase().includes(query),
		);
	}, [deferredMentionQuery, workspaces]);

	const filteredArtifacts = useMemo(() => {
		const query = deferredMentionQuery.trim().toLowerCase();
		if (!query) return artifacts;
		return artifacts.filter((artifact) =>
			`${artifact.title} ${artifact.fileName} ${artifact.tags.join(" ")}`.toLowerCase().includes(query),
		);
	}, [artifacts, deferredMentionQuery]);

	type MentionItem =
		| { type: "workspace"; workspace: WorkspaceSummary }
		| { type: "artifact"; artifact: ArtifactSummary };

	const mentionItems = useMemo<MentionItem[]>(() => [
		...filteredWorkspaces.map((workspace): MentionItem => ({ type: "workspace", workspace })),
		...filteredArtifacts.map((artifact): MentionItem => ({ type: "artifact", artifact })),
	], [filteredWorkspaces, filteredArtifacts]);

	const clampedIndex = mentionItems.length > 0
		? Math.min(mentionSelectedIndex, mentionItems.length - 1)
		: -1;

	useEffect(() => {
		if (clampedIndex < 0 || !mentionPickerRef.current) return;
		const el = mentionPickerRef.current.querySelector(`[data-mention-index="${clampedIndex}"]`);
		el?.scrollIntoView({ block: "nearest" });
	}, [clampedIndex]);

	const rememberSelection = () => {
		const element = promptRef.current;
		mentionSelectionRef.current = {
			start: element?.selectionStart ?? prompt.length,
			end: element?.selectionEnd ?? prompt.length,
		};
	};

	const openMentionPicker = () => {
		rememberSelection();
		setModelPickerOpen(false);
		setMentionPickerOpen(true);
	};

	const insertWorkspaceMention = (alias: string) => {
		const { start, end } = mentionSelectionRef.current;
		const mention = `@${alias} `;
		setPrompt((current) => {
			const next = `${current.slice(0, start)}${mention}${current.slice(end)}`;
			queueMicrotask(() => {
				const element = promptRef.current;
				const cursor = start + mention.length;
				element?.focus();
				element?.setSelectionRange(cursor, cursor);
			});
			return next;
		});
		setMentionPickerOpen(false);
	};

	const addMentionedArtifact = (artifact: ArtifactSummary) => {
		setMentionedArtifacts((current) =>
			current.some((entry) => entry.id === artifact.id) ? current : [...current, artifact],
		);
		setMentionPickerOpen(false);
		queueMicrotask(() => promptRef.current?.focus());
	};

	const removeMentionedArtifact = (artifactId: string) => {
		setMentionedArtifacts((current) => current.filter((artifact) => artifact.id !== artifactId));
	};

	const handleAttach = async () => {
		try {
			const { paths } = await pickFilesViaBun();
			if (paths.length > 0) {
				setAttachments((prev) => [
					...prev,
					...paths.map((path) => ({ path, name: basename(path) })),
				]);
			}
		} catch {
			// user cancelled file picker
		}
	};

	const removeAttachment = (index: number) => {
		setAttachments((prev) => prev.filter((_, i) => i !== index));
	};

	// Prevent the webview from navigating when files are dragged/dropped
	// outside the form target. Uses capture phase.
	useEffect(() => {
		const prevent = (e: DragEvent) => e.preventDefault();
		document.addEventListener("dragover", prevent, true);
		document.addEventListener("drop", prevent, true);
		return () => {
			document.removeEventListener("dragover", prevent, true);
			document.removeEventListener("drop", prevent, true);
		};
	}, []);

	const handleDragOver = (e: React.DragEvent<HTMLFormElement>) => {
		e.preventDefault();
		setIsDragOver(true);
	};

	const handleDragEnter = (e: React.DragEvent<HTMLFormElement>) => {
		e.preventDefault();
		setIsDragOver(true);
	};

	const handleDragLeave = (e: React.DragEvent<HTMLFormElement>) => {
		if (e.currentTarget.contains(e.relatedTarget as Node)) return;
		setIsDragOver(false);
	};

	const handleDrop = async (e: React.DragEvent<HTMLFormElement>) => {
		e.preventDefault();
		setIsDragOver(false);
		const files = e.dataTransfer.files;
		if (files.length === 0) return;

		const fileArray = Array.from(files);
		const results = await Promise.all(
			fileArray.map(async (file) => {
				// WKWebView doesn't provide .path on File objects — read the data
				// and write to a temp file on the bun side
				const buffer = await file.arrayBuffer();
				const base64 = btoa(
					new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), ""),
				);
				const { path } = await writeTempFileViaBun(file.name, base64);
				return { path, name: basename(path) } satisfies Attachment;
			}),
		);
		setAttachments((prev) => [...prev, ...results]);
	};

	const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (isBusy || disabled) return;
		const text = prompt.trim();
		if (!text) return;

		const attachmentPaths = attachments.map((attachment) => attachment.path);
		const mentionedArtifactIds = mentionedArtifacts.map((artifact) => artifact.id);
		setPrompt("");
		setAttachments([]);
		setMentionedArtifacts([]);

		void onSubmit({
			prompt: text,
			modelId,
			attachmentPaths: attachmentPaths.length > 0 ? attachmentPaths : undefined,
			mentionedArtifactIds: mentionedArtifactIds.length > 0 ? mentionedArtifactIds : undefined,
		}).catch((error) => {
			console.error("[piwork:view] composer submit failed:", error);
		});
	};

	const composerDisabled = disabled || isBusy;

	return (
		<div className={className}>
				<form
				onSubmit={handleSubmit}
				onDragOver={handleDragOver}
				onDragEnter={handleDragEnter}
				onDragLeave={handleDragLeave}
				onDrop={handleDrop}
				className={`prompt-surface flex flex-col gap-1 px-2 py-1.5 transition-colors ${isDragOver ? "ring-2 ring-[var(--accent)] ring-inset" : ""}`}
			>
				{(mentionedArtifacts.length > 0 || attachments.length > 0) && (
					<div className="flex flex-wrap items-center gap-1 px-0.5 pb-0.5">
						{mentionedArtifacts.map((artifact) => (
							<span
								key={artifact.id}
								className="inline-flex h-6 items-center gap-1 rounded-full border border-white/8 bg-white/[0.03] px-2.5 text-[10px] text-[var(--text-muted)]"
							>
								<span className="text-[var(--accent)]">@</span>
								<span className="max-w-[180px] truncate">{artifact.title}</span>
								<button
									type="button"
									onClick={() => removeMentionedArtifact(artifact.id)}
									className="rounded p-0.5 hover:bg-white/10"
									disabled={isBusy}
								>
									<svg width="10" height="10" viewBox="0 0 16 16" fill="none">
										<path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
									</svg>
								</button>
							</span>
						))}

						{attachments.map((attachment, index) => (
							<span
								key={`${attachment.path}-${index}`}
								className="inline-flex h-6 items-center gap-1 rounded-full border border-white/6 bg-white/[0.02] px-2.5 text-[10px] text-[var(--text-muted)]"
							>
								<svg width="12" height="12" viewBox="0 0 16 16" fill="none" className="shrink-0 opacity-50">
									<path d="M4 2h5l4 4v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" stroke="currentColor" strokeWidth="1.2" />
								</svg>
								<span className="max-w-[180px] truncate">{attachment.name}</span>
								<button
									type="button"
									onClick={() => removeAttachment(index)}
									className="rounded p-0.5 hover:bg-white/10"
									disabled={isBusy}
								>
									<svg width="10" height="10" viewBox="0 0 16 16" fill="none">
										<path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
									</svg>
								</button>
							</span>
						))}
					</div>
				)}

				<label className="sr-only" htmlFor="chat-composer-prompt">
					Prompt
				</label>
				<textarea
					ref={promptRef}
					id="chat-composer-prompt"
					value={prompt}
					onChange={(event) => setPrompt(event.target.value)}
					onClick={rememberSelection}
					onKeyUp={rememberSelection}
					onKeyDown={(event) => {
						if (event.key === "@" && !event.metaKey && !event.ctrlKey && !event.altKey) {
							event.preventDefault();
							openMentionPicker();
							return;
						}
						if (event.key === "Enter" && !event.shiftKey) {
							event.preventDefault();
							event.currentTarget.form?.requestSubmit();
						}
					}}
					placeholder={placeholder}
					className="min-h-9 resize-none rounded-xl bg-transparent px-2 py-1 text-[12px] leading-[1.25rem] text-[var(--text-primary)] outline-none ring-0 placeholder:text-[var(--text-dim)] focus:outline-none focus:ring-0 focus-visible:outline-none"
					rows={1}
					disabled={composerDisabled}
				/>

				<div className="flex items-center gap-1.5 border-t border-white/6 px-0.5 pt-1">
					<button
						type="button"
						onClick={openMentionPicker}
						className="focus-ring inline-flex h-6.5 items-center gap-1 rounded-md border border-white/6 px-2.5 text-[10px] font-medium text-[var(--text-muted)] transition hover:bg-white/5"
						title="Mention workspaces or artifacts"
						disabled={composerDisabled}
					>
						<span className="text-[var(--accent)]">@</span>
						Mention
					</button>

					<button
						type="button"
						onClick={handleAttach}
						className="focus-ring inline-flex h-6.5 items-center gap-1 rounded-md border border-white/6 px-2.5 text-[10px] font-medium text-[var(--text-muted)] transition hover:bg-white/5"
						title="Attach files"
						disabled={composerDisabled}
					>
						<svg width="14" height="14" viewBox="0 0 16 16" fill="none">
							<path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
						</svg>
						Attach
					</button>

					<div className="relative">
						<button
							type="button"
							onClick={() => {
								setMentionPickerOpen(false);
								setModelPickerOpen(true);
							}}
							className="focus-ring inline-flex h-6.5 items-center gap-1 rounded-md border border-white/6 px-2.5 text-[10px] font-medium text-[var(--text-muted)] transition hover:bg-white/5"
							disabled={composerDisabled}
						>
							<svg width="12" height="12" viewBox="0 0 16 16" fill="none" className="opacity-50">
								<circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2" />
								<circle cx="8" cy="8" r="2" fill="currentColor" />
							</svg>
							<span className="max-w-[132px] truncate">{selectedModelLabel}</span>
							<svg width="10" height="10" viewBox="0 0 16 16" fill="none" className="opacity-40">
								<path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
							</svg>
						</button>
					</div>

					<div className="flex-1" />

					<button
						type="submit"
						disabled={composerDisabled}
						className="focus-ring inline-flex h-7 items-center justify-center rounded-lg bg-[var(--accent)] px-3.5 text-[10px] font-semibold text-[var(--accent-foreground)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
					>
						{isBusy ? "Working…" : submitLabel}
					</button>
				</div>

				{(disabledReason || modelLoadError) && (
					<div className="px-1 pt-1 text-[10px] text-[var(--text-dim)]">
						{disabledReason ?? modelLoadError}
					</div>
				)}
			</form>

			{modelPickerOpen && createPortal(
				<div className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/55 p-4 backdrop-blur-[2px] sm:items-center">
					<div
						ref={pickerRef}
						className="flex h-[min(78vh,640px)] w-full max-w-[560px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[var(--overlay-panel)] shadow-2xl"
					>
						<div className="border-b border-white/6 px-4 py-3">
							<div className="flex items-center justify-between gap-3">
								<div>
									<h2 className="text-[12px] font-semibold text-[var(--text-primary)]">Choose model</h2>
									<p className="mt-0.5 text-[10px] text-[var(--text-dim)]">
										Search by provider, family, or exact model name.
									</p>
								</div>
								<button
									type="button"
									onClick={() => setModelPickerOpen(false)}
									className="focus-ring rounded-md px-2 py-1 text-[10px] text-[var(--text-dim)] transition hover:bg-white/5 hover:text-[var(--text-primary)]"
								>
									Close
								</button>
							</div>
							<input
								ref={pickerInputRef}
								value={modelQuery}
								onChange={(event) => setModelQuery(event.target.value)}
								placeholder="Search models..."
								className="focus-ring mt-3 h-9 w-full rounded-xl border border-white/8 bg-white/[0.03] px-3 text-[12px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-dim)]"
							/>
						</div>

						<div className="flex items-center justify-between border-b border-white/6 px-4 py-2 text-[10px] text-[var(--text-dim)]">
							<span>{filteredModels.length} models</span>
							<span>{modelId ? selectedModelLabel : "Auto selected"}</span>
						</div>

						<div className="scroll-region flex-1 px-2 py-2">
							<button
								type="button"
								onClick={() => {
									setModelId(undefined);
									onModelChange?.(undefined);
									setModelPickerOpen(false);
								}}
								className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition ${
									!modelId ? "bg-white/[0.05] text-[var(--text-primary)]" : "text-[var(--text-muted)] hover:bg-white/[0.03] hover:text-[var(--text-primary)]"
								}`}
							>
								<div>
									<div className="text-[12px] font-medium">Auto</div>
									<div className="mt-0.5 text-[10px] text-[var(--text-dim)]">
										Let piwork choose the default model
									</div>
								</div>
								{!modelId && <span className="text-[10px] text-[var(--accent)]">Current</span>}
							</button>

							{filteredModels.length > 0 ? (
								<div className="mt-1 flex flex-col gap-0.5">
									{filteredModels.map((model) => {
										const fullId = `${model.provider}/${model.id}`;
										const isActive = modelId === fullId;
										return (
											<button
												key={fullId}
												type="button"
												onClick={() => {
													setModelId(fullId);
													onModelChange?.(fullId);
													setModelPickerOpen(false);
												}}
												className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition ${
													isActive ? "bg-white/[0.05] text-[var(--text-primary)]" : "text-[var(--text-muted)] hover:bg-white/[0.03] hover:text-[var(--text-primary)]"
												}`}
											>
												<div className="min-w-0">
													<div className="truncate text-[12px] font-medium">{model.name}</div>
													<div className="mt-0.5 truncate text-[10px] text-[var(--text-dim)]">
														{model.provider}/{model.id}
													</div>
												</div>
												{isActive && <span className="text-[10px] text-[var(--accent)]">Current</span>}
											</button>
										);
									})}
								</div>
							) : (
								<div className="px-3 py-6 text-[11px] text-[var(--text-dim)]">
									No models matched that search.
								</div>
							)}
						</div>
					</div>
				</div>,
				document.body,
			)}

			{mentionPickerOpen && createPortal(
				<div
					className="fixed inset-0 z-[9998] flex items-end justify-center bg-black/55 p-4 backdrop-blur-[2px] sm:items-center"
					onMouseDown={() => setMentionPickerOpen(false)}
				>
					<div
						ref={mentionPickerRef}
						onMouseDown={(event) => event.stopPropagation()}
						className="flex h-[min(76vh,620px)] w-full max-w-[620px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[var(--overlay-panel)] shadow-2xl"
					>
						<div className="border-b border-white/6 px-4 py-3">
							<div className="flex items-center justify-between gap-3">
								<div>
									<h2 className="text-[12px] font-semibold text-[var(--text-primary)]">Mention context</h2>
									<p className="mt-0.5 text-[10px] text-[var(--text-dim)]">
										Insert indexed folders or reference piwork artifacts.
									</p>
								</div>
								<button
									type="button"
									onClick={() => setMentionPickerOpen(false)}
									className="focus-ring rounded-md px-2 py-1 text-[10px] text-[var(--text-dim)] transition hover:bg-white/5 hover:text-[var(--text-primary)]"
								>
									Close
								</button>
							</div>
							<input
								ref={mentionInputRef}
								value={mentionQuery}
								onChange={(event) => setMentionQuery(event.target.value)}
								onKeyDown={handleMentionKeyDown}
								placeholder="Search folders and artifacts..."
								className="focus-ring mt-3 h-9 w-full rounded-xl border border-white/8 bg-white/[0.03] px-3 text-[12px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-dim)]"
							/>
						</div>

						<div className="scroll-region flex-1 px-3 py-3">
							<div className="space-y-4">
								<div>
									<div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-dim)]">
										Vault folders
									</div>
									<div className="flex flex-col gap-1">
										{filteredWorkspaces.length > 0 ? filteredWorkspaces.map((workspace, wi) => {
											const flatIndex = wi;
											const highlighted = flatIndex === clampedIndex;
											return (
												<button
													key={workspace.id}
													type="button"
													data-mention-index={flatIndex}
													onClick={() => insertWorkspaceMention(workspace.alias)}
													onMouseEnter={() => setMentionSelectedIndex(flatIndex)}
													className={`flex items-center justify-between rounded-xl border px-3 py-2 text-left transition ${
														highlighted
															? "border-[var(--accent)]/30 bg-white/[0.06]"
															: "border-white/6 bg-white/[0.02] hover:bg-white/[0.04]"
													}`}
												>
													<div className="min-w-0">
														<div className="text-[12px] font-medium text-[var(--text-primary)]">@{workspace.alias}</div>
														<div className="mt-0.5 truncate text-[10px] text-[var(--text-dim)]">{workspace.path}</div>
													</div>
													<span className="text-[10px] text-[var(--text-dim)]">{workspace.fileCount} files</span>
												</button>
											);
										}) : (
											<div className="rounded-xl border border-white/6 bg-white/[0.02] px-3 py-3 text-[11px] text-[var(--text-dim)]">
												No indexed folders matched.
											</div>
										)}
									</div>
								</div>

								<div>
									<div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-dim)]">
										Artifacts
									</div>
									<div className="flex flex-col gap-1">
										{filteredArtifacts.length > 0 ? filteredArtifacts.map((artifact, ai) => {
											const flatIndex = filteredWorkspaces.length + ai;
											const highlighted = flatIndex === clampedIndex;
											const selected = mentionedArtifacts.some((entry) => entry.id === artifact.id);
											return (
												<button
													key={artifact.id}
													type="button"
													data-mention-index={flatIndex}
													onClick={() => addMentionedArtifact(artifact)}
													onMouseEnter={() => setMentionSelectedIndex(flatIndex)}
													className={`flex items-start justify-between rounded-xl border px-3 py-2 text-left transition ${
														highlighted
															? "border-[var(--accent)]/30 bg-white/[0.06]"
															: selected
																? "border-[var(--border-strong)] bg-[var(--accent-surface)]"
																: "border-white/6 bg-white/[0.02] hover:bg-white/[0.04]"
													}`}
												>
													<div className="min-w-0">
														<div className="flex items-center gap-1.5">
															<span className="truncate text-[12px] font-medium text-[var(--text-primary)]">
																{artifact.title}
															</span>
															<span className="artifact-kind shrink-0">{artifact.kind}</span>
														</div>
														<div className="mt-0.5 truncate text-[10px] text-[var(--text-dim)]">
															{artifact.fileName}
														</div>
														<div className="mt-1 truncate text-[10px] text-[var(--text-muted)]">
															{previewText(artifact.excerpt || "No preview available.")}
														</div>
													</div>
													<span className={`shrink-0 pl-2 text-[10px] ${selected ? "text-[var(--accent)]" : "text-[var(--text-dim)]"}`}>
														{selected ? "Added" : formatRelativeTime(artifact.updatedAt)}
													</span>
												</button>
											);
										}) : (
											<div className="rounded-xl border border-white/6 bg-white/[0.02] px-3 py-3 text-[11px] text-[var(--text-dim)]">
												No artifacts matched.
											</div>
										)}
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>,
				document.body,
			)}
		</div>
	);
}
