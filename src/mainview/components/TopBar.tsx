import type { ArtifactDetail, ChatThread } from "../../shared/view-rpc";
import type { ChatRuntimeActivity, ViewMode } from "../app-shared";

export default function TopBar({
	activeView,
	activeArtifact,
	activeChat,
	activeRuntimeActivity,
	canRetryLastPrompt,
	onBackToArtifacts,
	onCancelActiveRun,
	onRetryLastPrompt,
}: {
	activeView: ViewMode;
	activeArtifact: ArtifactDetail | null;
	activeChat: ChatThread | null;
	activeRuntimeActivity?: ChatRuntimeActivity;
	canRetryLastPrompt: boolean;
	onBackToArtifacts: () => void;
	onCancelActiveRun: () => void;
	onRetryLastPrompt: () => void;
}) {
	const title =
		activeView === "settings"
			? "Settings"
			: activeView === "artifacts"
				? "Documents"
				: activeView === "artifact-detail" && activeArtifact
					? activeArtifact.title
					: activeChat?.title ?? "New thread";

	return (
		<div className="flex h-9 shrink-0 items-center justify-between border-b border-white/6 px-3.5">
			<div className="flex min-w-0 items-center gap-1.5">
				{activeView === "artifact-detail" && (
					<button
						type="button"
						onClick={onBackToArtifacts}
						className="mr-1 text-xs text-[var(--text-muted)] transition hover:text-[var(--text-primary)]"
					>
						&larr;
					</button>
				)}
				<span className="truncate text-[13px] font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
					{title}
				</span>
			</div>
			<div className="flex items-center gap-1.5">
				{activeView === "chat" && activeRuntimeActivity && (
					<button
						type="button"
						onClick={onCancelActiveRun}
						className="secondary-button px-2.5 py-1 text-[10px]"
					>
						Cancel
					</button>
				)}
				{activeView === "chat" && canRetryLastPrompt && (
					<button
						type="button"
						onClick={onRetryLastPrompt}
						className="secondary-button px-2.5 py-1 text-[10px]"
					>
						Retry
					</button>
				)}
			</div>
		</div>
	);
}
