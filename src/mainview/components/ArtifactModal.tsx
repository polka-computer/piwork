import { useEffect } from "react";
import { createPortal } from "react-dom";
import type { ArtifactDetail } from "../../shared/view-rpc";
import { showArtifactInFinderViaBun } from "../rpc";
import ArtifactTagEditor from "./ArtifactTagEditor";
import MarkdownRenderer from "./MarkdownRenderer";

export default function ArtifactModal({
	artifact,
	onSaveTags,
	onClose,
}: {
	artifact: ArtifactDetail;
	onSaveTags: (artifactId: string, tags: string[]) => Promise<void>;
	onClose: () => void;
}) {
	useEffect(() => {
		const handleKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") onClose();
		};
		document.addEventListener("keydown", handleKey);
		return () => document.removeEventListener("keydown", handleKey);
	}, [onClose]);

	return createPortal(
		<div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-[2px]" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
			<div className="flex h-[min(84vh,860px)] w-full max-w-[980px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[var(--overlay-panel)] shadow-2xl">
				<div className="flex items-center justify-between border-b border-white/6 px-4 py-3">
					<div className="min-w-0">
						<div className="truncate text-[13px] font-semibold text-[var(--text-primary)]">{artifact.title}</div>
						<div className="mt-0.5 flex flex-wrap items-center gap-2">
							<span className="artifact-kind">{artifact.kind}</span>
							<span className="truncate text-[10px] text-[var(--text-dim)]">{artifact.fileName}</span>
							<ArtifactTagEditor artifact={artifact} onSave={onSaveTags} compact />
						</div>
					</div>
					<div className="flex items-center gap-1.5">
						<button
							type="button"
							onClick={() => void showArtifactInFinderViaBun(artifact.id)}
							className="focus-ring inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/8 text-[var(--text-dim)] transition hover:bg-white/5 hover:text-[var(--text-primary)]"
							title="Show in Finder"
						>
							<svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
								<path d="M6 3H3.75A1.75 1.75 0 0 0 2 4.75v7.5C2 13.216 2.784 14 3.75 14h7.5A1.75 1.75 0 0 0 13 12.25V10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
								<path d="M9 2h5v5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
								<path d="M14 2 7.5 8.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
							</svg>
						</button>
						<button
							type="button"
							onClick={onClose}
							className="focus-ring rounded-md px-2 py-1 text-[10px] text-[var(--text-dim)] transition hover:bg-white/5 hover:text-[var(--text-primary)]"
						>
							Close
						</button>
					</div>
				</div>
				<div className="scroll-region flex-1 px-4 py-3">
					<div className="artifact-preview">
						{artifact.kind === "image" ? (
							<img src={(artifact as any).previewUrl} alt={artifact.title} className="max-w-full rounded-lg" />
						) : artifact.kind === "video" ? (
							<video src={(artifact as any).previewUrl} controls className="max-w-full rounded-lg" />
						) : artifact.kind === "markdown" ? (
							<MarkdownRenderer content={(artifact as any).content} />
						) : (
							<pre className="whitespace-pre-wrap text-[13px] leading-6 text-[var(--text-primary)]">
								{(artifact as any).content}
							</pre>
						)}
					</div>
				</div>
			</div>
		</div>,
		document.body,
	);
}
