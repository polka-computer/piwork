import { Updater } from "electrobun/bun";
import { arch as getArch, platform as getPlatform } from "node:os";
import type { AppInfo, UpdateState, UpdateStatusEntry } from "../shared/view-rpc";
import { getModelStatus } from "./model-registry";
import { PIWORK_ROOT_DIR } from "./piwork-paths";
import * as store from "./piwork-store";
import type { QmdManager } from "./qmd-manager";

export const APP_NAME = "piwork";

const detectPlatform = (): AppInfo["platform"] => {
	switch (getPlatform()) {
		case "darwin":
			return "macos";
		case "win32":
			return "win";
		default:
			return "linux";
	}
};

const detectArch = (): AppInfo["arch"] => {
	if (detectPlatform() === "win") return "x64";
	return getArch() === "arm64" ? "arm64" : "x64";
};

const getCurrentUpdateState = (): UpdateState => {
	const update = Updater.updateInfo?.();
	const statusHistory = Updater.getStatusHistory?.() ?? [];
	return {
		version: update?.version,
		hash: update?.hash,
		updateAvailable: update?.updateAvailable ?? false,
		updateReady: update?.updateReady ?? false,
		error: update?.error || undefined,
		lastStatus: statusHistory[statusHistory.length - 1] as UpdateStatusEntry | undefined,
	};
};

const loadBundledPackageVersion = async (): Promise<string> => {
	try {
		const packageJson = await Bun.file(new URL("../../package.json", import.meta.url)).json() as {
			version?: string;
		};
		return packageJson.version || "0.0.0";
	} catch {
		return "0.0.0";
	}
};

const getLocalAppInfo = async (packageVersion: string): Promise<Pick<AppInfo, "version" | "channel" | "baseUrl">> => {
	try {
		const [version, channel, baseUrl] = await Promise.all([
			Updater.localInfo.version(),
			Updater.localInfo.channel(),
			Updater.localInfo.baseUrl(),
		]);
		return {
			version: version || packageVersion,
			channel: channel || "dev",
			baseUrl: baseUrl || "",
		};
	} catch {
		return {
			version: packageVersion,
			channel: "dev",
			baseUrl: "",
		};
	}
};

export const createAppInfoLoader = (qmdManager: QmdManager) => {
	const packageVersionPromise = loadBundledPackageVersion();

	return async (): Promise<AppInfo> => {
		const packageVersion = await packageVersionPromise;
		const [{ version, channel, baseUrl }, selectedModelId, modelStatus, qmdStatus] = await Promise.all([
			getLocalAppInfo(packageVersion),
			store.getSelectedModel(),
			getModelStatus(),
			qmdManager.getStatus(),
		]);

		return {
			name: APP_NAME,
			version,
			channel,
			baseUrl,
			dataRoot: PIWORK_ROOT_DIR,
			platform: detectPlatform(),
			arch: detectArch(),
			selectedModelId,
			modelStatus,
			qmd: {
				...qmdStatus,
				lastError: qmdStatus.lastError || undefined,
			},
			update: getCurrentUpdateState(),
		};
	};
};
