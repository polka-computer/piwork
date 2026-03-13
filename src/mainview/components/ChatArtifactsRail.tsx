import type { ChatThread } from "../../shared/view-rpc";
import { formatRelativeTime } from "../app-shared";

export default function ChatArtifactsRail({
	activeChat,
	onOpenArtifact,
}: {
	activeChat: ChatThread | null;
	onOpenArtifact: (artifactId: string, options?: { modal?: boolean }) => void;
}) {
	return (
		<aside className="flex w-[248px] shrink-0 flex-col border-l border-white/6 bg-[rgba(255,255,255,0.015)]">
			<div className="flex h-9 shrink-0 items-center justify-between border-b border-white/6 px-3">
				<div>
					<div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-dim)]">
						Attachments
					</div>
				</div>
				<span className="text-[9px] text-[var(--text-dim)]">
					{activeChat?.artifacts.length ?? 0}
				</span>
			</div>
			<div className="scroll-region flex-1 px-2 py-2">
				{activeChat?.artifacts.length ? (
					<div className="flex flex-col gap-1">
						{activeChat.artifacts.map((artifact) => (
							<button
								type="button"
								key={artifact.id}
								onClick={() => onOpenArtifact(artifact.id, { modal: true })}
								className="artifact-rail-item text-left"
							>
								<div className="flex items-center justify-between gap-2">
									<span className="truncate text-[11px] font-medium text-[var(--text-primary)]">
										{artifact.title}
									</span>
									<span className="shrink-0 text-[9px] text-[var(--text-dim)]">
										{formatRelativeTime(artifact.updatedAt)}
									</span>
								</div>
								<div className="mt-1 flex items-center gap-1.5">
									<span className="artifact-kind">{artifact.kind}</span>
									{artifact.tags.slice(0, 2).map((tag) => (
										<span key={tag} className="artifact-tag">#{tag}</span>
									))}
									<span className="truncate text-[9px] text-[var(--text-dim)]">{artifact.fileName}</span>
								</div>
							</button>
						))}
					</div>
				) : (
					<div className="px-2 py-3 text-[11px] text-[var(--text-dim)]">
						Files created in this chat will show up here.
					</div>
				)}
			</div>
		</aside>
	);
}
