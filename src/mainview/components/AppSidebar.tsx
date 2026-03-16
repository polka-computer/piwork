import { createPortal } from "react-dom";
import {
	useCallback,
	useEffect,
	useRef,
	useState,
	type MouseEvent as ReactMouseEvent,
	type ReactNode,
} from "react";
import type { ChatStatus, ChatSummary, DashboardState } from "../../shared/view-rpc";
import {
	CHAT_STATUS_TONES,
	DRAFT_SECTION_LABEL,
	type SidebarSectionKey,
	type ViewMode,
	formatRelativeTime,
} from "../app-shared";
import { DRAFT_STATUS_TONE } from "../theme/status";

type ChatSection = {
	status: ChatStatus;
	label: string;
	chats: ChatSummary[];
};

function SidebarChevron({ open }: { open: boolean }) {
	return (
		<svg
			width="12"
			height="12"
			viewBox="0 0 12 12"
			fill="none"
			aria-hidden="true"
			className={`shrink-0 text-[var(--text-dim)] transition-transform ${open ? "rotate-90" : ""}`}
		>
			<path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
		</svg>
	);
}

function SidebarFolderButton({
	label,
	meta,
	open,
	active,
	compact,
	onClick,
	onContextMenu,
	dotClassName,
	labelClassName,
}: {
	label: string;
	meta?: string;
	open: boolean;
	active?: boolean;
	compact?: boolean;
	onClick: () => void;
	onContextMenu?: (event: ReactMouseEvent<HTMLButtonElement>) => void;
	dotClassName?: string;
	labelClassName?: string;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			onContextMenu={onContextMenu}
			className={`sidebar-folder-button ${compact ? "sidebar-folder-button-compact" : ""} ${
				active ? "sidebar-folder-button-active" : ""
			}`}
		>
			<span className="flex min-w-0 items-center gap-2">
				<SidebarChevron open={open} />
				{dotClassName && <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotClassName}`} />}
				<span className={`truncate text-left text-[11.5px] font-medium ${labelClassName ?? "text-[var(--text-primary)]"}`}>
					{label}
				</span>
			</span>
			{meta && <span className="shrink-0 text-[10px] text-[var(--text-dim)]">{meta}</span>}
		</button>
	);
}

function SidebarLeafButton({
	label,
	meta,
	active,
	prominent,
	description,
	icon,
	disabled,
	onClick,
}: {
	label: string;
	meta?: string;
	active?: boolean;
	prominent?: boolean;
	description?: string;
	icon?: ReactNode;
	disabled?: boolean;
	onClick?: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
			className={`sidebar-row flex w-full items-center justify-between rounded-md px-3 py-1.5 text-left transition ${
				active
					? prominent
						? "sidebar-destination-button sidebar-destination-button-active text-[var(--text-primary)]"
						: "bg-white/[0.045] text-[var(--text-primary)]"
					: disabled
						? "cursor-default text-[var(--text-muted)]"
						: prominent
							? "sidebar-destination-button text-[var(--text-primary)]"
							: "text-[var(--text-muted)] hover:bg-white/[0.03] hover:text-[var(--text-primary)]"
			}`}
		>
			<span className="flex min-w-0 items-center gap-2.5">
				{icon && <span className="sidebar-destination-icon">{icon}</span>}
				<span className="min-w-0">
					<span className={`block truncate text-inherit ${prominent ? "text-[12.5px] font-semibold" : "text-[12px] font-medium"}`}>
						{label}
					</span>
					{description && (
						<span className="mt-0.5 block truncate text-[10px] font-medium text-[var(--text-dim)]">
							{description}
						</span>
					)}
				</span>
			</span>
			{meta && <span className="text-[10px] text-[var(--text-dim)]">{meta}</span>}
		</button>
	);
}

function ChatListItem({
	chat,
	active,
	onClick,
	onArchive,
	onDelete,
}: {
	chat: ChatSummary;
	active: boolean;
	onClick: () => void;
	onArchive: (archived: boolean) => void;
	onDelete: () => void;
}) {
	const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
	const [confirmDelete, setConfirmDelete] = useState(false);
	const menuRef = useRef<HTMLDivElement>(null);
	const tone = CHAT_STATUS_TONES[chat.status];

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

	return (
		<>
			<div className="group relative">
				<button
					type="button"
					onClick={() => {
						if (!ctxMenu) onClick();
					}}
					onContextMenu={(event) => {
						event.preventDefault();
						event.stopPropagation();
						setCtxMenu({ x: event.clientX, y: event.clientY });
						setConfirmDelete(false);
					}}
					className={`thread-card thread-row thread-row-sidebar w-full pr-8 text-left ${active ? tone.activeCard : ""}`}
				>
					<div className="flex items-center justify-between gap-2">
						<div className="flex min-w-0 items-center gap-1.5">
							<span className={`h-1.5 w-1.5 shrink-0 rounded-full ${tone.dot}`} />
							<span className="truncate text-[11px] font-medium tracking-[-0.01em] text-[var(--text-primary)]">{chat.title}</span>
						</div>
						<span className="shrink-0 text-[9.5px] text-[var(--text-dim)] transition-opacity group-hover:opacity-0">
							{formatRelativeTime(chat.updatedAt)}
						</span>
					</div>
				</button>

				{chat.status !== "archived" && (
					<button
						type="button"
						aria-label="Archive chat"
						title="Archive chat"
						onClick={(event) => {
							event.preventDefault();
							event.stopPropagation();
							void onArchive(true);
						}}
						className="pointer-events-none absolute right-1.5 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md border border-white/8 bg-[var(--overlay-menu)] text-[var(--text-dim)] opacity-0 transition hover:border-white/14 hover:bg-white/[0.05] hover:text-[var(--text-primary)] group-hover:pointer-events-auto group-hover:opacity-100"
					>
						<svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
							<path
								d="M3.5 4.5h9m-8.25 0 .5 7.25c.04.64.57 1.13 1.2 1.13h3.1c.63 0 1.16-.49 1.2-1.13l.5-7.25M6.25 4.5V3.4c0-.5.4-.9.9-.9h1.7c.5 0 .9.4.9.9v1.1"
								stroke="currentColor"
								strokeWidth="1.2"
								strokeLinecap="round"
								strokeLinejoin="round"
							/>
						</svg>
					</button>
				)}
			</div>

			{ctxMenu && createPortal(
				<div
					ref={menuRef}
					style={{ position: "fixed", left: ctxMenu.x, top: ctxMenu.y, zIndex: 9999 }}
					className="min-w-[148px] rounded-xl border border-white/8 bg-[var(--overlay-menu)] py-1 shadow-2xl"
				>
					{confirmDelete ? (
						<>
							<p className="px-3 py-1.5 text-[11px] text-[var(--text-muted)]">Delete this chat?</p>
							<div className="flex items-center gap-1 px-2 pb-1">
								<button
									type="button"
									className="rounded-md bg-[var(--danger-border)] px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-[#8a3747]"
									onClick={(event) => {
										event.stopPropagation();
										closeMenu();
										onDelete();
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
									closeMenu();
									onClick();
								}}
							>
								Open
							</button>
							<button
								type="button"
								className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] text-[var(--text-primary)] transition hover:bg-white/[0.04]"
								onClick={(event) => {
									event.stopPropagation();
									closeMenu();
									onArchive(chat.status !== "archived");
								}}
							>
								{chat.status === "archived" ? "Unarchive" : "Archive"}
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

export default function AppSidebar({
	activeView,
	activeChatId,
	dashboard,
	artifactCount,
	collapsedSidebarSections,
	chatSearchQuery,
	draftChats,
	chatSections,
	filteredVisibleChatsLength,
	onCreateChat,
	onOpenSettings,
	onOpenArtifacts,
	onOpenPiworkFolder,
	onToggleSidebarSection,
	onChatSearchQueryChange,
	onSelectChat,
	onArchiveChat,
	onDeleteChat,
	onArchiveCompletedChats,
}: {
	activeView: ViewMode;
	activeChatId?: string;
	dashboard: DashboardState;
	artifactCount: number;
	collapsedSidebarSections: Record<SidebarSectionKey, boolean>;
	chatSearchQuery: string;
	draftChats: ChatSummary[];
	chatSections: ChatSection[];
	filteredVisibleChatsLength: number;
	onCreateChat: () => void;
	onOpenSettings: () => void;
	onOpenArtifacts: () => void;
	onOpenPiworkFolder: () => void;
	onToggleSidebarSection: (key: SidebarSectionKey) => void;
	onChatSearchQueryChange: (value: string) => void;
	onSelectChat: (chatId: string) => void;
	onArchiveChat: (chatId: string, archived: boolean) => void;
	onDeleteChat: (chatId: string) => void;
	onArchiveCompletedChats: () => void;
}) {
	const [sectionContextMenu, setSectionContextMenu] = useState<{ x: number; y: number } | null>(null);
	const sectionContextMenuRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!sectionContextMenu) return;
		const handleClick = (event: MouseEvent) => {
			if (
				sectionContextMenuRef.current &&
				!sectionContextMenuRef.current.contains(event.target as Node)
			) {
				setSectionContextMenu(null);
			}
		};
		const handleKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") setSectionContextMenu(null);
		};
		document.addEventListener("mousedown", handleClick);
		document.addEventListener("keydown", handleKey);
		return () => {
			document.removeEventListener("mousedown", handleClick);
			document.removeEventListener("keydown", handleKey);
		};
	}, [sectionContextMenu]);

	return (
		<>
			<aside className="flex w-[292px] shrink-0 flex-col border-r border-white/6 bg-[var(--bg-sidebar)]">
				<div className="border-b border-white/6 px-4 pb-2 pt-2.5">
					<div className="flex items-center justify-between gap-2">
						<div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--text-dim)]">
							piwork
						</div>
						<div className="flex items-center gap-1.5">
							<button
								type="button"
								onClick={onOpenPiworkFolder}
								aria-label="Open piwork folder"
								title="Open piwork folder"
								className="sidebar-utility-button"
							>
								<svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
									<path
										d="M2.75 4.25h3.1l1.15 1.25h6.25c.41 0 .75.34.75.75v5c0 .83-.67 1.5-1.5 1.5h-9c-.83 0-1.5-.67-1.5-1.5v-5.5c0-.83.67-1.5 1.5-1.5Z"
										stroke="currentColor"
										strokeWidth="1.15"
										strokeLinejoin="round"
									/>
									<path d="M6.25 8.25h3.5" stroke="currentColor" strokeWidth="1.15" strokeLinecap="round" />
								</svg>
							</button>
							<button
								type="button"
								onClick={onOpenSettings}
								aria-label="Open settings"
								title="Settings"
								className={`sidebar-utility-button ${activeView === "settings" ? "sidebar-utility-button-active" : ""}`}
							>
								<svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
									<path
										d="M6.7 2.2h2.6l.35 1.74a4.8 4.8 0 0 1 1.13.66l1.63-.63 1.3 2.26-1.28 1.15c.05.2.07.4.07.6 0 .21-.02.42-.07.62l1.28 1.15-1.3 2.25-1.63-.63a4.8 4.8 0 0 1-1.13.66l-.35 1.75H6.7l-.35-1.75a4.8 4.8 0 0 1-1.13-.66l-1.63.63-1.3-2.25 1.28-1.15a2.76 2.76 0 0 1 0-1.22L2.29 6.25l1.3-2.26 1.63.63c.35-.28.73-.5 1.13-.66L6.7 2.2Z"
										stroke="currentColor"
										strokeWidth="1.15"
										strokeLinejoin="round"
									/>
									<circle cx="8" cy="8" r="1.9" stroke="currentColor" strokeWidth="1.15" />
								</svg>
							</button>
						</div>
					</div>
				</div>
				<div className="border-b border-white/6 px-3 py-2">
					<div className="flex items-center gap-2">
						<button
							type="button"
							onClick={onCreateChat}
							className="sidebar-primary-action flex-1"
						>
							<span className="sidebar-primary-action-icon">+</span>
							<span>New chat</span>
						</button>
					</div>
				</div>

				<div className="scroll-region flex-1 px-3 py-2.5">
					<div className="flex flex-col gap-1.5">
						<SidebarLeafButton
							label="Documents"
							meta={artifactCount > 0 ? `${artifactCount}` : undefined}
							active={activeView === "artifacts" || activeView === "artifact-detail"}
							prominent
							description="Browse generated files"
							icon={
								<svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
									<path
										d="M4 2.75h5l3 3v7.5c0 .41-.34.75-.75.75h-7.5A.75.75 0 0 1 3 13.25v-9.5c0-.41.34-.75.75-.75H4Z"
										stroke="currentColor"
										strokeWidth="1.15"
										strokeLinejoin="round"
									/>
									<path d="M9 2.75v3h3" stroke="currentColor" strokeWidth="1.15" strokeLinejoin="round" />
								</svg>
							}
							onClick={onOpenArtifacts}
						/>

						<div className="sidebar-section">
							<SidebarFolderButton
								label="Chats"
								meta={`${dashboard.chats.length}`}
								open={!collapsedSidebarSections.chats}
								active={activeView === "chat"}
								onClick={() => onToggleSidebarSection("chats")}
							/>

							{!collapsedSidebarSections.chats && (
								<>
									<div className="mt-2 px-1">
										<input
											value={chatSearchQuery}
											onChange={(event) => onChatSearchQueryChange(event.target.value)}
											placeholder="Search chats"
											className="focus-ring h-8 w-full rounded-md border border-white/8 bg-white/[0.03] px-2.5 text-[11px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-dim)]"
										/>
									</div>

									<div className="mt-2 flex flex-col gap-1.5">
										{draftChats.length > 0 && (
											<div className="chat-status-group chat-status-group-draft">
												<SidebarFolderButton
													label={DRAFT_SECTION_LABEL}
													meta={`${draftChats.length}`}
													open={!collapsedSidebarSections.drafts}
													compact
													labelClassName={DRAFT_STATUS_TONE.label}
													onClick={() => onToggleSidebarSection("drafts")}
												/>
												{!collapsedSidebarSections.drafts && (
													<div className="chat-status-list">
														{draftChats.map((chat) => (
															<ChatListItem
																key={chat.id}
																chat={chat}
																active={activeChatId === chat.id && activeView === "chat"}
																onClick={() => onSelectChat(chat.id)}
																onArchive={(archived) => onArchiveChat(chat.id, archived)}
																onDelete={() => onDeleteChat(chat.id)}
															/>
														))}
													</div>
												)}
											</div>
										)}
										{chatSections.map((section) => (
											<div key={section.status} className={CHAT_STATUS_TONES[section.status].lane}>
												<SidebarFolderButton
													label={section.label}
													meta={`${section.chats.length}`}
													open={!collapsedSidebarSections[section.status]}
													compact
													labelClassName={CHAT_STATUS_TONES[section.status].label}
													onClick={() => onToggleSidebarSection(section.status)}
													onContextMenu={
														section.status === "completed"
															? (event) => {
																event.preventDefault();
																event.stopPropagation();
																setSectionContextMenu({
																	x: event.clientX,
																	y: event.clientY,
																});
															}
															: undefined
													}
												/>
												{!collapsedSidebarSections[section.status] && (
													<div className="chat-status-list">
														{section.chats.map((chat) => (
															<ChatListItem
																key={chat.id}
																chat={chat}
																active={activeChatId === chat.id && activeView === "chat"}
																onClick={() => onSelectChat(chat.id)}
																onArchive={(archived) => onArchiveChat(chat.id, archived)}
																onDelete={() => onDeleteChat(chat.id)}
															/>
														))}
													</div>
												)}
											</div>
										))}
										{filteredVisibleChatsLength === 0 && (
											<div className="px-2 py-3 text-[10px] text-[var(--text-dim)]">
												No chats matched that search.
											</div>
										)}
									</div>
								</>
							)}
						</div>
					</div>
				</div>
			</aside>

			{sectionContextMenu && createPortal(
				<div
					ref={sectionContextMenuRef}
					style={{
						position: "fixed",
						left: sectionContextMenu.x,
						top: sectionContextMenu.y,
						zIndex: 9999,
					}}
					className="min-w-[160px] rounded-xl border border-white/8 bg-[var(--overlay-menu)] py-1 shadow-2xl"
				>
					<button
						type="button"
						className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] text-[var(--text-primary)] transition hover:bg-white/[0.04]"
						onClick={() => {
							setSectionContextMenu(null);
							onArchiveCompletedChats();
						}}
					>
						Archive all
					</button>
				</div>,
				document.body,
			)}
		</>
	);
}
