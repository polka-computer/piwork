import { Utils } from "electrobun/bun";
import { join } from "node:path";

export interface PiworkPaths {
	rootDir: string;
	chatsDir: string;
	objectsDir: string;
	sessionsDir: string;
	settingsDir: string;
	indexDir: string;
	configFile: string;
	artifactIndexDb: string;
	searchDbPath: string;
	memoryFile: string;
	tocFile: string;
	linksFile: string;
	dailyDir: string;
}

const ROOT_DIR = Utils.paths.userData;

export const PIWORK_ROOT_DIR = ROOT_DIR;
export const PIWORK_CHATS_DIR = join(ROOT_DIR, "chats");
export const PIWORK_OBJECTS_DIR = join(ROOT_DIR, "objects");
export const PIWORK_SESSIONS_DIR = join(ROOT_DIR, "sessions");
export const PIWORK_SETTINGS_DIR = join(ROOT_DIR, "settings");
export const PIWORK_INDEX_DIR = join(ROOT_DIR, "index");
export const PIWORK_CONFIG_FILE = join(PIWORK_SETTINGS_DIR, "config.json");
export const PIWORK_ARTIFACT_INDEX_DB = join(PIWORK_INDEX_DIR, "artifacts.sqlite");
export const PIWORK_SEARCH_DB_PATH = join(ROOT_DIR, "search.sqlite");
export const PIWORK_MEMORY_FILE = join(ROOT_DIR, "memory.md");
export const PIWORK_TOC_FILE = join(ROOT_DIR, "toc.md");
export const PIWORK_LINKS_FILE = join(ROOT_DIR, "links.csv");
export const PIWORK_DAILY_DIR = join(ROOT_DIR, "daily");

export const getPiworkPaths = (): PiworkPaths => ({
	rootDir: PIWORK_ROOT_DIR,
	chatsDir: PIWORK_CHATS_DIR,
	objectsDir: PIWORK_OBJECTS_DIR,
	sessionsDir: PIWORK_SESSIONS_DIR,
	settingsDir: PIWORK_SETTINGS_DIR,
	indexDir: PIWORK_INDEX_DIR,
	configFile: PIWORK_CONFIG_FILE,
	artifactIndexDb: PIWORK_ARTIFACT_INDEX_DB,
	searchDbPath: PIWORK_SEARCH_DB_PATH,
	memoryFile: PIWORK_MEMORY_FILE,
	tocFile: PIWORK_TOC_FILE,
	linksFile: PIWORK_LINKS_FILE,
	dailyDir: PIWORK_DAILY_DIR,
});
