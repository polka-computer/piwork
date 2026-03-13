import type { ChatStatus } from "../../shared/view-rpc";

export const CHAT_STATUS_TONES: Record<
	ChatStatus,
	{ dot: string; badge: string; activeCard: string; lane: string; label: string }
> = {
	needs_review: {
		dot: "bg-[var(--accent)]",
		badge: "border-[var(--border-strong)] bg-[var(--accent-surface)] text-[var(--text-primary)]",
		activeCard: "bg-[rgba(101,87,178,0.16)] shadow-[inset_2px_0_0_rgba(214,164,92,0.4)]",
		lane: "chat-status-group chat-status-group-review",
		label: "text-[var(--status-review-label)]",
	},
	running: {
		dot: "bg-[var(--status-running-dot)]",
		badge: "border-[var(--status-running-border)] bg-[var(--status-running-bg)] text-[var(--status-running-text)]",
		activeCard: "bg-[rgba(86,116,220,0.1)] shadow-[inset_2px_0_0_rgba(86,116,220,0.4)]",
		lane: "chat-status-group chat-status-group-running",
		label: "text-[var(--status-running-label)]",
	},
	completed: {
		dot: "bg-[var(--status-completed-dot)]",
		badge: "border-white/8 bg-white/[0.03] text-[var(--text-muted)]",
		activeCard: "bg-[rgba(132,122,185,0.1)] shadow-[inset_2px_0_0_rgba(132,122,185,0.28)]",
		lane: "chat-status-group chat-status-group-completed",
		label: "text-[var(--status-completed-label)]",
	},
	archived: {
		dot: "bg-[var(--status-archived-dot)]",
		badge: "border-white/8 bg-transparent text-[var(--text-dim)]",
		activeCard: "bg-[rgba(97,92,114,0.08)] shadow-[inset_2px_0_0_rgba(97,92,114,0.22)]",
		lane: "chat-status-group chat-status-group-archived",
		label: "text-[var(--status-archived-label)]",
	},
};

export const DRAFT_STATUS_TONE = {
	dot: "bg-[var(--status-draft-dot)]",
	label: "text-[var(--status-draft-label)]",
} as const;
