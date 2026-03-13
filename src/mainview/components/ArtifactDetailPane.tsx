import type { ArtifactDetail } from "../../shared/view-rpc";
import { formatDate } from "../app-shared";
import { showArtifactInFinderViaBun } from "../rpc";
import ArtifactTagEditor from "./ArtifactTagEditor";
import MarkdownRenderer from "./MarkdownRenderer";

export default function ArtifactDetailPane({
	activeArtifact,
	onSaveArtifactTags,
}: {
	activeArtifact: ArtifactDetail | null;
	onSaveArtifactTags: (artifactId: string, tags: string[]) => Promise<void>;
}) {
	if (!activeArtifact) {
		return (
			<div className="flex min-h-0 flex-1 items-center justify-center">
				<p className="text-sm text-[var(--text-muted)]">No artifact selected.</p>
			</div>
		);
	}

	return (
		<div className="flex min-h-0 flex-1 flex-col">
			<div className="scroll-region flex-1 px-3 py-2">
				<div className="mx-auto max-w-[860px]">
					<div className="flex flex-wrap items-center justify-between gap-3">
						<div className="flex min-w-0 flex-1 items-center gap-2">
							<span className="artifact-kind">{activeArtifact.kind}</span>
							<span className="truncate text-[10px] text-[var(--text-muted)]">{activeArtifact.fileName}</span>
						</div>
						<div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
							<ArtifactTagEditor artifact={activeArtifact} onSave={onSaveArtifactTags} compact />
							<button
								type="button"
								onClick={() => void showArtifactInFinderViaBun(activeArtifact.id)}
								className="focus-ring inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/8 text-[var(--text-dim)] transition hover:bg-white/[0.04] hover:text-[var(--text-primary)]"
								title="Show in Finder"
							>
								<svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
									<path d="M6 3H3.75A1.75 1.75 0 0 0 2 4.75v7.5C2 13.216 2.784 14 3.75 14h7.5A1.75 1.75 0 0 0 13 12.25V10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
									<path d="M9 2h5v5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
									<path d="M14 2 7.5 8.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
								</svg>
							</button>
							<span className="text-[10px] text-[var(--text-muted)]">
								Updated {formatDate(activeArtifact.updatedAt)}
							</span>
						</div>
					</div>
					<div className="artifact-preview mt-3">
						{activeArtifact.kind === "image" ? (
							<img src={(activeArtifact as any).previewUrl} alt={activeArtifact.title} className="max-w-full rounded-lg" />
						) : activeArtifact.kind === "video" ? (
							<video src={(activeArtifact as any).previewUrl} controls className="max-w-full rounded-lg" />
						) : activeArtifact.kind === "markdown" ? (
							<MarkdownRenderer content={(activeArtifact as any).content} />
						) : (
							<pre className="whitespace-pre-wrap text-[14px] leading-7 text-[var(--text-primary)]">
								{(activeArtifact as any).content}
							</pre>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
