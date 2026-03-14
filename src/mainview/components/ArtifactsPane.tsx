import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ArtifactKind, DashboardState } from "../../shared/view-rpc";
import {
	MAX_ARTIFACT_CARD_TAGS,
	MAX_ARTIFACT_FILTER_TAGS,
} from "../app-shared";

export default function ArtifactsPane({
	dashboard,
	artifactSearchQuery,
	artifactKindFilter,
	artifactChatFilter,
	artifactTagFilters,
	artifactTagTrayOpen,
	artifactShowAllTags,
	filteredArtifacts,
	artifactTagCounts,
	orderedArtifactTags,
	onArtifactSearchQueryChange,
	onArtifactKindFilterChange,
	onArtifactChatFilterChange,
	onToggleArtifactTagTray,
	onClearArtifactFilters,
	onToggleArtifactShowAllTags,
	onHideArtifactTagTray,
	onToggleArtifactTagFilter,
	onOpenArtifact,
	onDeleteArtifact,
}: {
	dashboard: DashboardState | null;
	artifactSearchQuery: string;
	artifactKindFilter: ArtifactKind | "all";
	artifactChatFilter: string;
	artifactTagFilters: string[];
	artifactTagTrayOpen: boolean;
	artifactShowAllTags: boolean;
	filteredArtifacts: DashboardState["artifacts"];
	artifactTagCounts: Map<string, number>;
	orderedArtifactTags: string[];
	onArtifactSearchQueryChange: (value: string) => void;
	onArtifactKindFilterChange: (value: ArtifactKind | "all") => void;
	onArtifactChatFilterChange: (value: string) => void;
	onToggleArtifactTagTray: () => void;
	onClearArtifactFilters: () => void;
	onToggleArtifactShowAllTags: () => void;
	onHideArtifactTagTray: () => void;
	onToggleArtifactTagFilter: (tag: string) => void;
	onOpenArtifact: (artifactId: string) => void;
	onDeleteArtifact: (artifactId: string) => void;
}) {
	const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; artifactId: string } | null>(null);
	const [confirmDelete, setConfirmDelete] = useState(false);
	const menuRef = useRef<HTMLDivElement>(null);

	const closeMenu = useCallback(() => {
		setCtxMenu(null);
		setConfirmDelete(false);
	}, []);

	useEffect(() => {
		if (!ctxMenu) return;
		const handleClick = (event: MouseEvent) => {
			if (menuRef.current && !menuRef.current.contains(event.target as Node)) closeMenu();
		};
		const handleKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") closeMenu();
		};
		document.addEventListener("mousedown", handleClick);
		document.addEventListener("keydown", handleKey);
		return () => {
			document.removeEventListener("mousedown", handleClick);
			document.removeEventListener("keydown", handleKey);
		};
	}, [ctxMenu, closeMenu]);

	const visibleArtifactFilterTags = artifactShowAllTags
		? orderedArtifactTags
		: orderedArtifactTags.slice(0, MAX_ARTIFACT_FILTER_TAGS);

	return (
		<>
		<div className="flex min-h-0 flex-1 flex-col">
			<div className="border-b border-white/6 px-3 py-2">
				<div className="flex flex-col gap-2">
					<input
						value={artifactSearchQuery}
						onChange={(event) => onArtifactSearchQueryChange(event.target.value)}
						placeholder="Search documents by title, tag, or excerpt"
						className="focus-ring h-8 rounded-md border border-white/8 bg-white/[0.03] px-3 text-[11px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-dim)]"
					/>
					<div className="flex flex-wrap items-center gap-2">
						<select
							value={artifactKindFilter}
							onChange={(event) => onArtifactKindFilterChange(event.target.value as ArtifactKind | "all")}
							className="focus-ring h-7 rounded-md border border-white/8 bg-white/[0.03] px-2.5 text-[10px] text-[var(--text-primary)] outline-none"
						>
							<option value="all">All kinds</option>
							<option value="markdown">Markdown</option>
							<option value="csv">CSV</option>
							<option value="json">JSON</option>
							<option value="text">Text</option>
							<option value="image">Image</option>
							<option value="video">Video</option>
							<option value="other">Other</option>
						</select>
						<select
							value={artifactChatFilter}
							onChange={(event) => onArtifactChatFilterChange(event.target.value)}
							className="focus-ring h-7 max-w-[240px] rounded-md border border-white/8 bg-white/[0.03] px-2.5 text-[10px] text-[var(--text-primary)] outline-none"
						>
							<option value="all">All chats</option>
							{dashboard?.chats.map((chat) => (
								<option key={chat.id} value={chat.id}>{chat.title}</option>
							))}
						</select>
						<button
							type="button"
							onClick={onToggleArtifactTagTray}
							className={`focus-ring inline-flex h-7 items-center gap-2 rounded-md border px-2.5 text-[10px] outline-none transition ${
								artifactTagTrayOpen || artifactTagFilters.length > 0
									? "border-[var(--border-strong)] bg-[var(--accent-surface)] text-[var(--text-primary)]"
									: "border-white/8 bg-white/[0.03] text-[var(--text-muted)] hover:bg-white/[0.05] hover:text-[var(--text-primary)]"
							}`}
						>
							<span>Tags</span>
							{artifactTagFilters.length > 0 && (
								<span className="rounded-full bg-white/[0.08] px-1.5 py-[1px] text-[9px] text-[var(--text-primary)]">
									{artifactTagFilters.length}
								</span>
							)}
						</button>
						{(artifactSearchQuery || artifactKindFilter !== "all" || artifactChatFilter !== "all" || artifactTagFilters.length > 0) && (
							<button
								type="button"
								onClick={onClearArtifactFilters}
								className="focus-ring rounded-md px-2 py-1 text-[10px] text-[var(--text-dim)] transition hover:bg-white/5 hover:text-[var(--text-primary)]"
							>
								Clear all
							</button>
						)}
					</div>
					{artifactTagFilters.length > 0 && (
						<div className="flex flex-wrap items-center gap-1.5">
							<div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[var(--text-dim)]">
								Selected
							</div>
							{artifactTagFilters.map((tag) => (
								<button
									key={tag}
									type="button"
									onClick={() => onToggleArtifactTagFilter(tag)}
									className="artifact-filter-chip artifact-filter-chip-active"
								>
									<span>#{tag}</span>
									<span className="artifact-filter-chip-count">{artifactTagCounts.get(tag) ?? 0}</span>
								</button>
							))}
						</div>
					)}
					{artifactTagTrayOpen && (
						<div className="artifact-filter-tray">
							<div className="flex items-center justify-between gap-2">
								<div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[var(--text-dim)]">
									Tag filters
								</div>
								<div className="flex items-center gap-2">
									{orderedArtifactTags.length > MAX_ARTIFACT_FILTER_TAGS && (
										<button
											type="button"
											onClick={onToggleArtifactShowAllTags}
											className="text-[10px] text-[var(--text-dim)] transition hover:text-[var(--text-primary)]"
										>
											{artifactShowAllTags ? "Show fewer" : `Show all ${orderedArtifactTags.length}`}
										</button>
									)}
									<button
										type="button"
										onClick={onHideArtifactTagTray}
										className="text-[10px] text-[var(--text-dim)] transition hover:text-[var(--text-primary)]"
									>
										Hide
									</button>
								</div>
							</div>
							<div className="mt-2 flex flex-wrap gap-1.5">
								{visibleArtifactFilterTags.length > 0 ? visibleArtifactFilterTags.map((tag) => {
									const active = artifactTagFilters.includes(tag);
									return (
										<button
											key={tag}
											type="button"
											onClick={() => onToggleArtifactTagFilter(tag)}
											className={`artifact-filter-chip ${active ? "artifact-filter-chip-active" : ""}`}
										>
											<span>#{tag}</span>
											<span className="artifact-filter-chip-count">{artifactTagCounts.get(tag) ?? 0}</span>
										</button>
									);
								}) : (
									<span className="text-[10px] text-[var(--text-dim)]">No tags yet</span>
								)}
							</div>
						</div>
					)}
				</div>
			</div>
			<div className="scroll-region flex-1 px-3 py-2">
				<div className="mx-auto max-w-[1080px]">
					{filteredArtifacts.length ? (
						<div className="artifact-gallery">
							{/* Interleave image/text cards so CSS columns distribute height evenly */}
							{(() => {
								const images = filteredArtifacts.filter((a) => a.thumbnailUrl);
								const texts = filteredArtifacts.filter((a) => !a.thumbnailUrl);
								const merged: typeof filteredArtifacts = [];
								let ii = 0, ti = 0;
								while (ii < images.length || ti < texts.length) {
									if (ti < texts.length) merged.push(texts[ti++]);
									if (ii < images.length) merged.push(images[ii++]);
									if (ti < texts.length) merged.push(texts[ti++]);
								}
								return merged;
							})().map((artifact) => (
								<button
									type="button"
									key={artifact.id}
									onClick={() => onOpenArtifact(artifact.id)}
									onContextMenu={(event) => {
										event.preventDefault();
										event.stopPropagation();
										setCtxMenu({ x: event.clientX, y: event.clientY, artifactId: artifact.id });
										setConfirmDelete(false);
									}}
									className="artifact-card text-left"
								>
									{artifact.thumbnailUrl && (
										<div className="artifact-card-thumbnail">
											<img src={artifact.thumbnailUrl} alt={artifact.title} />
										</div>
									)}
									<div className="artifact-card-body">
										<div className="truncate text-[13px] font-medium text-[var(--text-primary)]">
											{artifact.title}
										</div>
										<div className="mt-1.5 flex flex-wrap items-center gap-1.5">
											<span className="artifact-kind shrink-0">{artifact.kind}</span>
											{artifact.tags.slice(0, MAX_ARTIFACT_CARD_TAGS).map((tag) => (
												<span key={tag} className="artifact-tag shrink-0">#{tag}</span>
											))}
											{artifact.tags.length > MAX_ARTIFACT_CARD_TAGS && (
												<span className="artifact-tag shrink-0">+{artifact.tags.length - MAX_ARTIFACT_CARD_TAGS}</span>
											)}
										</div>
									</div>
								</button>
							))}
						</div>
					) : (
						<div className="empty-state">
							<h2 className="text-[13px] font-semibold text-[var(--text-primary)]">
								{dashboard?.artifacts.length ? "No artifacts match these filters" : "No artifacts yet"}
							</h2>
							<p className="mt-1 text-[12px] leading-5 text-[var(--text-muted)]">
								{dashboard?.artifacts.length
									? "Try another tag, kind, or chat filter."
									: "Artifacts will appear here when piwork creates files from your chats."}
							</p>
						</div>
					)}
				</div>
			</div>
		</div>
		{ctxMenu && createPortal(
			<div
				ref={menuRef}
				style={{ position: "fixed", left: ctxMenu.x, top: ctxMenu.y, zIndex: 9999 }}
				className="min-w-[148px] rounded-xl border border-white/8 bg-[var(--overlay-menu)] py-1 shadow-2xl"
			>
				{confirmDelete ? (
					<>
						<p className="px-3 py-1.5 text-[11px] text-[var(--text-muted)]">Delete this artifact?</p>
						<div className="flex items-center gap-1 px-2 pb-1">
							<button
								type="button"
								className="rounded-md bg-[var(--danger-border)] px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-[#8a3747]"
								onClick={(event) => {
									event.stopPropagation();
									const id = ctxMenu.artifactId;
									closeMenu();
									onDeleteArtifact(id);
								}}
							>
								Delete
							</button>
							<button
								type="button"
								className="rounded-md px-2.5 py-1 text-[11px] font-medium text-[var(--text-muted)] transition hover:bg-white/[0.04]"
								onClick={(event) => {
									event.stopPropagation();
									closeMenu();
								}}
							>
								Cancel
							</button>
						</div>
					</>
				) : (
					<>
						<button
							type="button"
							className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] text-[var(--text-primary)] transition hover:bg-white/[0.04]"
							onClick={(event) => {
								event.stopPropagation();
								const id = ctxMenu.artifactId;
								closeMenu();
								onOpenArtifact(id);
							}}
						>
							Open
						</button>
						<div className="my-1 border-t border-white/6" />
						<button
							type="button"
							className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[var(--danger)] transition hover:bg-[var(--danger-surface)]"
							onClick={(event) => {
								event.stopPropagation();
								setConfirmDelete(true);
							}}
						>
							Delete
						</button>
					</>
				)}
			</div>,
			document.body,
		)}
		</>
	);
}
