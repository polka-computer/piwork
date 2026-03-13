import { watch, type FSWatcher } from "node:fs";

const DEBOUNCE_MS = 120;

let watcher: FSWatcher | null = null;
const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

const getArtifactIdFromFilename = (filename: string): string | null => {
	const normalized = filename.replace(/\\/g, "/");
	const [artifactId] = normalized.split("/", 1);
	return artifactId?.trim() || null;
};

export const startArtifactWatcher = (
	objectsDir: string,
	onArtifactChange: (artifactId: string) => Promise<void>,
): void => {
	if (watcher) return;

	watcher = watch(objectsDir, { recursive: true }, (_event, filename) => {
		if (!filename) return;
		const artifactId = getArtifactIdFromFilename(filename);
		if (!artifactId) return;

		const existing = debounceTimers.get(artifactId);
		if (existing) clearTimeout(existing);

		debounceTimers.set(
			artifactId,
			setTimeout(async () => {
				debounceTimers.delete(artifactId);
				try {
					await onArtifactChange(artifactId);
				} catch (error) {
					console.error(`[piwork:watcher] Error syncing artifact ${artifactId}:`, error);
				}
			}, DEBOUNCE_MS),
		);
	});

	console.log(`[piwork:watcher] Watching ${objectsDir}`);
};

export const stopArtifactWatcher = (): void => {
	if (watcher) {
		watcher.close();
		watcher = null;
	}
	for (const timer of debounceTimers.values()) clearTimeout(timer);
	debounceTimers.clear();
};
