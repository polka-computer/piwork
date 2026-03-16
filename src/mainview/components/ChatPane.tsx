import { useEffect, useRef } from "react";
import type { ArtifactSummary, ChatThread, DashboardState } from "../../shared/view-rpc";
import type { ChatRuntimeActivity } from "../app-shared";
import type { ComposerSubmitInput } from "./ChatComposer";
import ChatComposer from "./ChatComposer";
import LiveRunPanel from "./LiveRunPanel";
import MessageBubble from "./MessageBubble";

export default function ChatPane({
	activeChat,
	artifactLookup,
	needsWorkspaceSetup,
	modelUnavailable,
	modelError,
	activeRuntimeActivity,
	composerBlockedReason,
	composerIsBusy,
	composerModelId,
	composerWorkspaces,
	composerArtifacts,
	composerFocusToken,
	onOpenArtifact,
	onOpenSettings,
	onRefreshStatus,
	onModelChange,
	onSubmit,
}: {
	activeChat: ChatThread | null;
	artifactLookup: Map<string, ArtifactSummary>;
	needsWorkspaceSetup: boolean;
	modelUnavailable: boolean;
	modelError?: string;
	activeRuntimeActivity?: ChatRuntimeActivity;
	composerBlockedReason?: string;
	composerIsBusy: boolean;
	composerModelId?: string;
	composerWorkspaces: DashboardState["workspaces"];
	composerArtifacts: DashboardState["artifacts"];
	composerFocusToken: number;
	onOpenArtifact: (artifactId: string, options?: { modal?: boolean }) => void;
	onOpenSettings: () => void;
	onRefreshStatus: () => void;
	onModelChange: (modelId?: string) => void;
	onSubmit: (input: ComposerSubmitInput) => Promise<void>;
}) {
	const scrollRef = useRef<HTMLDivElement>(null);
	const bottomRef = useRef<HTMLDivElement>(null);

	const messageCount = activeChat?.messages.length ?? 0;
	const lastMessageId = activeChat?.messages[messageCount - 1]?.id;

	useEffect(() => {
		bottomRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [lastMessageId, messageCount]);

	return (
		<div className="flex min-h-0 flex-1 flex-col">
			<div ref={scrollRef} className="scroll-region flex-1 px-3 py-2">
				<div className="mx-auto flex w-full max-w-[860px] flex-col gap-1.5">
					{activeChat?.messages.length ? (
						activeChat.messages.map((message) => (
							<MessageBubble
								key={message.id}
								message={message}
								artifactsById={artifactLookup}
								onOpenArtifact={(artifactId) => onOpenArtifact(artifactId)}
							/>
						))
					) : (
						<div className="empty-state">
							<h2 className="text-[13px] font-semibold text-[var(--text-primary)]">
								{needsWorkspaceSetup ? "Start here. Add folders later if you want them." : "Work from your indexed folders."}
							</h2>
							<p className="mt-1 max-w-xl text-[12px] leading-5 text-[var(--text-muted)]">
								{needsWorkspaceSetup
									? "You can chat and create artifacts right away in the piwork home folder. Add read-only folders later if you want to reference them with @alias."
									: modelUnavailable
										? modelError || "piwork could not load your models yet. Open Settings to verify your model access and refresh the app status."
										: (
											<>
												Try prompts like <code>@notes turn these meeting bullets into a clean weekly recap</code>
												{" "}or <code>@project draft a markdown brief from the latest docs</code>.
											</>
										)}
							</p>
							{(needsWorkspaceSetup || modelUnavailable) && (
								<div className="mt-3 flex items-center gap-2">
									{needsWorkspaceSetup && (
										<button
											type="button"
											onClick={onOpenSettings}
											className="secondary-button"
										>
											Add Folders
										</button>
									)}
									{modelUnavailable && (
										<button
											type="button"
											onClick={onOpenSettings}
											className="secondary-button"
										>
											Open Settings
										</button>
									)}
									<button
										type="button"
										onClick={onRefreshStatus}
										className="secondary-button"
									>
										Refresh Status
									</button>
								</div>
							)}
						</div>
					)}
					<div ref={bottomRef} />
				</div>
			</div>

			<div className="border-t border-white/6 px-3 py-2">
				<div className="mx-auto max-w-[860px]">
					{activeRuntimeActivity && (
						<LiveRunPanel activity={activeRuntimeActivity} />
					)}
					<ChatComposer
						placeholder={composerBlockedReason ?? "Ask piwork. Use @alias to reference indexed folders."}
						defaultModelId={composerModelId}
						workspaces={composerWorkspaces}
						artifacts={composerArtifacts}
						autoFocus
						focusToken={composerFocusToken}
						disabled={Boolean(composerBlockedReason)}
						disabledReason={composerBlockedReason}
						isBusy={composerIsBusy}
						onModelChange={onModelChange}
						onSubmit={onSubmit}
					/>
				</div>
			</div>
		</div>
	);
}
