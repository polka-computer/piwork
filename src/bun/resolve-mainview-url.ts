import { Updater } from "electrobun/bun";

const DEV_SERVER_PORT = 5174;
const DEV_SERVER_URL = `http://localhost:${DEV_SERVER_PORT}`;
const BUNDLED_MAINVIEW_URL = "views://mainview/index.html";

const getLocalChannel = async (): Promise<string> => {
	try {
		return (await Updater.localInfo.channel()) || "dev";
	} catch {
		return "dev";
	}
};

export const resolveMainViewUrl = async (): Promise<string> => {
	const channel = await getLocalChannel();
	if (channel !== "dev") {
		return BUNDLED_MAINVIEW_URL;
	}

	try {
		await fetch(DEV_SERVER_URL, { method: "HEAD" });
		console.log(`[piwork:bun] HMR enabled via ${DEV_SERVER_URL}`);
		return DEV_SERVER_URL;
	} catch {
		console.log("[piwork:bun] Vite dev server not running. Falling back to bundled view.");
		return BUNDLED_MAINVIEW_URL;
	}
};
