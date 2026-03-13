import { Updater } from "electrobun/bun";

const INITIAL_DELAY_MS = 30_000;
const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 hours

interface AutoUpdateCheckerOptions {
	onUpdateFound: (version: string) => void;
}

export function startAutoUpdateChecker({ onUpdateFound }: AutoUpdateCheckerOptions) {
	void (async () => {
		try {
			const channel = await Updater.localInfo.channel();
			if (!channel || channel === "dev") {
				console.log("[piwork:bun] auto-update: skipping (dev channel)");
				return;
			}

			const runCheck = async () => {
				try {
					await Updater.checkForUpdate();
					const info = Updater.updateInfo?.();
					if (info?.updateAvailable && info.version) {
						onUpdateFound(info.version);
					}
				} catch (error) {
					console.error("[piwork:bun] auto-update check failed:", error);
				}
			};

			setTimeout(() => {
				void runCheck();
				setInterval(() => void runCheck(), CHECK_INTERVAL_MS);
			}, INITIAL_DELAY_MS);
		} catch (error) {
			console.error("[piwork:bun] auto-update checker init failed:", error);
		}
	})();
}
