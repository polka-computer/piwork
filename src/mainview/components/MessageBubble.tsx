import type { ArtifactSummary, ChatMessage } from "../../shared/view-rpc";
import MarkdownRenderer from "./MarkdownRenderer";

export default function MessageBubble({
	message,
	artifactsById,
	onOpenArtifact,
}: {
	message: ChatMessage;
	artifactsById: Map<string, ArtifactSummary>;
	onOpenArtifact: (artifactId: string) => void;
}) {
	return (
		<div className={`message-shell ${message.role === "user" ? "message-user" : "message-assistant"}`}>
			<div className="flex items-center gap-2">
				<span className="text-[10px] text-[var(--text-dim)]">
					{message.role === "user" ? "You" : "piwork"}
				</span>
				{message.meta?.selectedModel && (
					<span className="text-[10px] text-[var(--text-dim)]">
						· {message.meta.selectedModel}
						{message.meta.durationMs ? ` · ${(message.meta.durationMs / 1000).toFixed(1)}s` : ""}
					</span>
				)}
			</div>
			<div
				className={`markdown-body mt-1.5 ${
					message.role === "user"
						? "text-[11.5px] leading-5 text-[var(--text-muted)]"
						: "text-[12.5px] leading-6 text-[var(--text-primary)]"
				}`}
			>
				<MarkdownRenderer content={message.content} />
			</div>
			{message.artifactIds.length > 0 && (
				<div className="mt-2.5 flex flex-wrap gap-1.5">
					{message.artifactIds.map((artifactId) => (
						<button
							key={artifactId}
							type="button"
							onClick={() => onOpenArtifact(artifactId)}
							className="rounded-full border border-white/8 px-2.5 py-1 text-[10px] font-medium text-[var(--text-muted)] transition hover:border-[var(--border-strong)] hover:bg-[var(--accent-surface)] hover:text-[var(--text-primary)]"
						>
							{message.role === "user" ? "Ref" : "Open"}{" "}
							{artifactsById.get(artifactId)?.title ?? "artifact"}
						</button>
					))}
				</div>
			)}
		</div>
	);
}
