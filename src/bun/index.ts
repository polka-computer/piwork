import { BrowserWindow, Updater } from "electrobun/bun";
import type { UpdateStatusEntry } from "../shared/view-rpc";
import { createAppInfoLoader, APP_NAME } from "./app-info";
import { installApplicationMenu } from "./application-menu";
import { startArtifactWatcher } from "./artifact-watcher";
import { createChatRunner } from "./chat-runner";
import { ensurePiworkDir } from "./ensure-piwork-dir";
import { createMainviewRpc } from "./mainview-rpc";
import { PIWORK_OBJECTS_DIR } from "./piwork-paths";
import * as store from "./piwork-store";
import { QmdManager } from "./qmd-manager";
import { resolveMainViewUrl } from "./resolve-mainview-url";

const qmdManager = new QmdManager();

const reinitializeQmd = async () => {
	try {
		const [workspaces, semanticSearchEnabled] = await Promise.all([
			store.listWorkspaces(),
			store.getSemanticSearchEnabled(),
		]);
		await qmdManager.initialize(
			workspaces.map((workspace) => ({
				name: workspace.alias,
				path: workspace.path,
				pattern: "**/*.md",
			})),
			{ semanticSearchEnabled },
		);
		// Auto-add context annotations for each workspace
		for (const workspace of workspaces) {
			await qmdManager.addContext(
				workspace.alias,
				"/",
				`Workspace "${workspace.alias}" — indexed folder at ${workspace.path}`,
			);
		}
		console.log(`[piwork:bun] qmd initialized with ${workspaces.length} workspace(s)`);
	} catch (error) {
		console.error("[piwork:bun] qmd initialization failed:", error);
	}
};

const getAppInfo = createAppInfoLoader(qmdManager);
const url = await resolveMainViewUrl();

installApplicationMenu(APP_NAME);

let rpc: ReturnType<typeof createMainviewRpc>;
const chatRunner = createChatRunner({
	qmdManager,
	sendOmpEvent: (event) => {
		rpc.send.ompEvent(event);
	},
});

rpc = createMainviewRpc({
	getAppInfo,
	reinitializeQmd,
	chatRunner,
});

Updater.onStatusChange?.((entry) => {
	rpc.send.updateStatus(entry as UpdateStatusEntry);
});

await ensurePiworkDir();
await store.initializeArtifactStore();
startArtifactWatcher(PIWORK_OBJECTS_DIR, async (artifactId) => {
	await store.syncArtifactFromDisk(artifactId);
});
void reinitializeQmd();

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

mainWindow.on("close", () => {
	console.log("[piwork:bun] window closed");
});

console.log(`[piwork:bun] shell started (${url})`);
