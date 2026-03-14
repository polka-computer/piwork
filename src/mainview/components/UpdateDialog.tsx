import { useEffect } from "react";
import { createPortal } from "react-dom";
import type { AppInfo, UpdateStatusEntry } from "../../shared/view-rpc";

export default function UpdateDialog({
	version,
	appInfo,
	latestUpdateStatus,
	onDownload,
	onApply,
	onDismiss,
}: {
	version: string;
	appInfo: AppInfo | null;
	latestUpdateStatus?: UpdateStatusEntry;
	onDownload: () => void;
	onApply: () => void;
	onDismiss: () => void;
}) {
	useEffect(() => {
		const handleKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") onDismiss();
		};
		document.addEventListener("keydown", handleKey);
		return () => document.removeEventListener("keydown", handleKey);
	}, [onDismiss]);

	const updateReady = appInfo?.update.updateReady ?? false;
	const updateAvailable = appInfo?.update.updateAvailable ?? false;

	return createPortal(
		<div
			className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-[2px]"
			onMouseDown={(e) => { if (e.target === e.currentTarget) onDismiss(); }}
		>
			<div className="w-full max-w-[400px] rounded-2xl border border-white/10 bg-[var(--overlay-panel)] p-6 shadow-2xl">
				<div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-dim)]">
					Update available
				</div>
				<div className="mt-2 text-[15px] font-semibold text-[var(--text-primary)]">
					piwork v{version}
				</div>
				<p className="mt-1 text-[12px] text-[var(--text-muted)]">
					You're currently on v{appInfo?.version ?? "0.0.0"}
				</p>

				{latestUpdateStatus && (
					<div className="mt-3 rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2 text-[10px] text-[var(--text-muted)]">
						<span className="font-medium text-[var(--text-primary)]">{latestUpdateStatus.message}</span>
						{typeof latestUpdateStatus.details?.progress === "number" && (
							<span> · {latestUpdateStatus.details.progress}%</span>
						)}
					</div>
				)}

				<div className="mt-5 flex items-center justify-end gap-2">
					<button
						type="button"
						onClick={onDismiss}
						className="secondary-button"
					>
						Later
					</button>
					{updateReady ? (
						<button
							type="button"
							onClick={onApply}
							className="primary-button"
						>
							Install &amp; Relaunch
						</button>
					) : (
						<button
							type="button"
							onClick={onDownload}
							className="primary-button"
							disabled={!updateAvailable}
						>
							Download Update
						</button>
					)}
				</div>
			</div>
		</div>,
		document.body,
	);
}
