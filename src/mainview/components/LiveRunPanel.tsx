import { ChatRuntimeActivity, previewText } from "../app-shared";

export default function LiveRunPanel({
	activity,
}: {
	activity: ChatRuntimeActivity;
}) {
	const primaryLabel = activity.lastError
		? "Issue"
		: activity.currentLabel
			?? (activity.assistantPreview ? "Composing" : activity.lastCompletedLabel ?? "Thinking");

	const secondaryLabel = activity.lastError
		? previewText(activity.lastError, 72)
		: activity.detailText
			? previewText(activity.detailText, 64)
			: activity.assistantPreview
				? previewText(activity.assistantPreview.split("\n").pop() ?? "", 64)
				: undefined;

	const isAnimating = !activity.lastError;

	return (
		<div className="mb-2 flex items-center gap-2">
			<span
				className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium ${
					activity.lastError
						? "border-[var(--danger-border)] bg-[var(--danger-surface)] text-[var(--danger-strong)]"
						: "border-[var(--border-strong)] bg-[var(--accent-surface)] text-[var(--text-primary)]"
				}`}
			>
				<span
					className={`inline-flex h-1.5 w-1.5 rounded-full ${
						activity.lastError
							? "bg-[var(--danger)]"
							: isAnimating
								? "animate-pulse bg-[var(--accent)]"
								: "bg-[var(--accent)]"
					}`}
				/>
				<span
					key={`${activity.threadId}-${primaryLabel}`}
					className="transition duration-200 ease-out data-[motion=swap]:translate-y-[-1px] data-[motion=swap]:opacity-90"
					data-motion={activity.lastError ? "static" : "swap"}
				>
					{primaryLabel}
				</span>
			</span>
			{secondaryLabel && (
				<span className={`truncate text-[10px] ${
					activity.lastError
						? "text-[var(--danger)]"
						: "text-[var(--text-muted)]"
				}`}>
					{secondaryLabel}
				</span>
			)}
		</div>
	);
}
