import { BrowserWindow, Updater, Utils } from "electrobun/bun";
import type { UpdateStatusEntry } from "../shared/view-rpc";
import { createAppInfoLoader, APP_NAME } from "./app-info";
import { installApplicationMenu } from "./application-menu";
import { startArtifactWatcher } from "./artifact-watcher";
import { createChatRunner } from "./chat-runner";
import { ensurePiworkDir } from "./ensure-piwork-dir";
import { startAutoUpdateChecker } from "./auto-update-checker";
import { createMainviewRpc } from "./mainview-rpc";
import { PIWORK_OBJECTS_DIR } from "./piwork-paths";
import * as store from "./piwork-store";
import { SearchEngine } from "./search-engine";
import { resolveMainViewUrl } from "./resolve-mainview-url";

const searchEngine = new SearchEngine();

const reinitializeSearch = async () => {
	try {
		const [workspaces, semanticSearchEnabled] = await Promise.all([
			store.listWorkspaces(),
			store.getSemanticSearchEnabled(),
		]);
		await searchEngine.initialize(
			workspaces.map((workspace) => ({
				name: workspace.alias,
				path: workspace.path,
				pattern: "**/*.md",
			})),
			{ semanticSearchEnabled },
		);
		// Auto-add context annotations for each workspace
		for (const workspace of workspaces) {
			await searchEngine.addContext(
				workspace.alias,
				"/",
				`Workspace "${workspace.alias}" — indexed folder at ${workspace.path}`,
			);
		}
		console.log(`[piwork:bun] search engine initialized with ${workspaces.length} workspace(s)`);
	} catch (error) {
		console.error("[piwork:bun] search engine initialization failed:", error);
	}
};

const getAppInfo = createAppInfoLoader(searchEngine);
const url = await resolveMainViewUrl();

installApplicationMenu(APP_NAME);

let rpc: ReturnType<typeof createMainviewRpc>;
const chatRunner = createChatRunner({
	searchEngine,
	sendOmpEvent: (event) => {
		rpc.send.ompEvent(event);
	},
});

rpc = createMainviewRpc({
	getAppInfo,
	reinitializeSearch,
	chatRunner,
});

Updater.onStatusChange?.((entry) => {
	rpc.send.updateStatus(entry as UpdateStatusEntry);
});

startAutoUpdateChecker({
	onUpdateFound: (version) => {
		rpc.send.updateAvailableNotification({ version });
	},
});

await ensurePiworkDir();
await store.initializeArtifactStore();
startArtifactWatcher(PIWORK_OBJECTS_DIR, async (artifactId) => {
	await store.syncArtifactFromDisk(artifactId);
});
void reinitializeSearch();

const mainWindow = new BrowserWindow({
	title: APP_NAME,
	url,
	rpc,
	frame: {
		x: 88,
		y: 56,
		width: 1120,
		height: 720,
	},
	titleBarStyle: "hiddenInset",
});

mainWindow.on("new-window-open", (event: any) => {
	const detail = event?.data?.detail;
	const url = typeof detail === "string" ? detail : detail?.url;
	if (url) Utils.openExternal(url);
});

mainWindow.on("close", () => {
	console.log("[piwork:bun] window closed");
});

console.log(`[piwork:bun] shell started (${url})`);
