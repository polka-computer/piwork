import { access, mkdir, writeFile } from "node:fs/promises";
import { ensurePiworkHomeFiles, getPiworkHomeFilePaths } from "./home-files";
import {
	PIWORK_CHATS_DIR,
	PIWORK_CONFIG_FILE,
	PIWORK_INDEX_DIR,
	PIWORK_OBJECTS_DIR,
	PIWORK_ROOT_DIR,
	PIWORK_SESSIONS_DIR,
	PIWORK_SETTINGS_DIR,
} from "./piwork-paths";

const exists = async (path: string): Promise<boolean> => {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
};

export const ensurePiworkDir = async (): Promise<void> => {
	for (const dir of [
		PIWORK_ROOT_DIR,
		PIWORK_CHATS_DIR,
		PIWORK_OBJECTS_DIR,
		PIWORK_SESSIONS_DIR,
		PIWORK_SETTINGS_DIR,
		PIWORK_INDEX_DIR,
	]) {
		await mkdir(dir, { recursive: true });
	}

	if (!(await exists(PIWORK_CONFIG_FILE))) {
		await writeFile(
			PIWORK_CONFIG_FILE,
			`${JSON.stringify({
				workspaces: [],
				homeFiles: getPiworkHomeFilePaths(),
			}, null, 2)}\n`,
			"utf-8",
		);
	}
	await ensurePiworkHomeFiles();
};
