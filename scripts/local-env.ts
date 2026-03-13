import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

interface LoadLocalEnvOptions {
	cwd?: string;
	filenames?: string[];
}

const DEFAULT_FILENAMES = [".env", ".env.local"];

const unquote = (value: string) => {
	if (value.length < 2) return value;

	const first = value[0];
	const last = value[value.length - 1];
	if ((first === "\"" && last === "\"") || (first === "'" && last === "'")) {
		const inner = value.slice(1, -1);
		if (first === "\"") {
			return inner
				.replace(/\\n/g, "\n")
				.replace(/\\r/g, "\r")
				.replace(/\\t/g, "\t")
				.replace(/\\"/g, "\"")
				.replace(/\\\\/g, "\\");
		}
		return inner;
	}

	return value;
};

const parseEnvFile = (contents: string) => {
	const entries = new Map<string, string>();

	for (const rawLine of contents.split(/\r?\n/)) {
		const line = rawLine.trim();
		if (!line || line.startsWith("#")) continue;

		const normalized = line.startsWith("export ") ? line.slice(7).trim() : line;
		const separatorIndex = normalized.indexOf("=");
		if (separatorIndex <= 0) continue;

		const key = normalized.slice(0, separatorIndex).trim();
		if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;

		const value = normalized.slice(separatorIndex + 1).trim();
		entries.set(key, unquote(value));
	}

	return entries;
};

export const loadLocalEnv = (options: LoadLocalEnvOptions = {}) => {
	const cwd = options.cwd ?? join(import.meta.dir, "..");
	const filenames = options.filenames ?? DEFAULT_FILENAMES;
	const loadedKeys = new Set<string>();

	for (const filename of filenames) {
		const path = join(cwd, filename);
		if (!existsSync(path)) continue;

		const entries = parseEnvFile(readFileSync(path, "utf8"));
		for (const [key, value] of entries) {
			if (process.env[key] === undefined || loadedKeys.has(key)) {
				process.env[key] = value;
				loadedKeys.add(key);
			}
		}
	}
};
