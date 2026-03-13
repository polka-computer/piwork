import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import {
	PIWORK_DAILY_DIR,
	PIWORK_LINKS_FILE,
	PIWORK_MEMORY_FILE,
	PIWORK_TOC_FILE,
} from "./piwork-paths";

const MEMORY_SECTIONS = ["User", "Preferences", "Projects", "Open Loops"] as const;
type MemorySection = (typeof MEMORY_SECTIONS)[number];

export interface PiworkHomeFilePaths {
	memoryPath: string;
	tocPath: string;
	linksPath: string;
	dailyDir: string;
}

interface LinkRow {
	created_at: string;
	last_seen_at: string;
	url: string;
	title: string;
	summary: string;
	tags: string;
	chat_id: string;
}

const HOME_FILE_PATHS: PiworkHomeFilePaths = {
	memoryPath: PIWORK_MEMORY_FILE,
	tocPath: PIWORK_TOC_FILE,
	linksPath: PIWORK_LINKS_FILE,
	dailyDir: PIWORK_DAILY_DIR,
};

const MEMORY_TEMPLATE = `${MEMORY_SECTIONS.map((section) => `## ${section}\n`).join("\n")}\n`;
const TOC_TEMPLATE = `# toc\n\n## General\n\n`;
const LINKS_HEADER = "created_at,last_seen_at,url,title,summary,tags,chat_id\n";

const fileExists = async (path: string): Promise<boolean> => {
	try {
		return await Bun.file(path).exists();
	} catch {
		return false;
	}
};

const readText = async (path: string, fallback: string): Promise<string> => {
	try {
		return await readFile(path, "utf-8");
	} catch {
		return fallback;
	}
};

const writeText = async (path: string, value: string): Promise<void> => {
	await writeFile(path, value, "utf-8");
};

const escapeCsv = (value: string): string => {
	const normalized = value.replace(/\r?\n/g, " ").trim();
	return `"${normalized.replace(/"/g, "\"\"")}"`;
};

const parseCsvLine = (line: string): string[] => {
	const values: string[] = [];
	let current = "";
	let inQuotes = false;
	for (let index = 0; index < line.length; index += 1) {
		const char = line[index];
		if (char === "\"") {
			if (inQuotes && line[index + 1] === "\"") {
				current += "\"";
				index += 1;
			} else {
				inQuotes = !inQuotes;
			}
			continue;
		}
		if (char === "," && !inQuotes) {
			values.push(current);
			current = "";
			continue;
		}
		current += char;
	}
	values.push(current);
	return values.map((value) => value.trim());
};

const normalizeUrl = (value: string): string => {
	try {
		const url = new URL(value.trim());
		url.hash = "";
		if ((url.protocol === "https:" && url.port === "443") || (url.protocol === "http:" && url.port === "80")) {
			url.port = "";
		}
		return url.toString();
	} catch {
		return value.trim();
	}
};

const normalizeTags = (tags: string[] | string | undefined): string[] => {
	const values = Array.isArray(tags) ? tags : tags?.split(",") ?? [];
	return Array.from(
		new Set(
			values
				.map((tag) => tag.trim().toLowerCase())
				.filter(Boolean),
		),
	).sort((left, right) => left.localeCompare(right));
};

const getTodayStamp = (): string => new Date().toISOString().slice(0, 10);

const dailyFilePath = (date = getTodayStamp()): string => join(PIWORK_DAILY_DIR, `${date}.md`);

const ensureMemorySections = (content: string): string => {
	let next = content.trim();
	if (!next) next = MEMORY_TEMPLATE.trim();
	for (const section of MEMORY_SECTIONS) {
		if (!new RegExp(`^## ${section}$`, "m").test(next)) {
			next += `\n\n## ${section}\n`;
		}
	}
	return `${next.trim()}\n`;
};

const upsertBulletInSection = (content: string, section: MemorySection, bullet: string): string => {
	const normalized = ensureMemorySections(content);
	const sectionHeader = `## ${section}`;
	const start = normalized.indexOf(sectionHeader);
	if (start < 0) return normalized;

	const remainder = normalized.slice(start + sectionHeader.length);
	const nextHeaderOffset = remainder.search(/\n## /);
	const sectionBody = nextHeaderOffset >= 0 ? remainder.slice(0, nextHeaderOffset) : remainder;
	const rest = nextHeaderOffset >= 0 ? remainder.slice(nextHeaderOffset) : "";
	const lines = sectionBody
		.trim()
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean);
	const entry = `- ${bullet.trim()}`;
	if (!lines.includes(entry)) lines.push(entry);

	return `${normalized.slice(0, start)}${sectionHeader}\n${lines.join("\n")}\n${rest.replace(/^\n/, "\n")}`.trimEnd() + "\n";
};

const normalizeHeading = (value: string): string => value.trim() || "General";

const upsertTocLine = (content: string, section: string, label: string, target: string, description?: string): string => {
	const normalizedSection = normalizeHeading(section);
	const toc = content.trim() ? content : TOC_TEMPLATE;
	const heading = `## ${normalizedSection}`;
	const entry = `- [${label.trim()}](${target.trim()})${description?.trim() ? ` - ${description.trim()}` : ""}`;

	if (!toc.includes(heading)) {
		return `${toc.trim()}\n\n${heading}\n\n${entry}\n`;
	}

	const start = toc.indexOf(heading);
	const remainder = toc.slice(start + heading.length);
	const nextHeaderOffset = remainder.search(/\n## /);
	const sectionBody = nextHeaderOffset >= 0 ? remainder.slice(0, nextHeaderOffset) : remainder;
	const rest = nextHeaderOffset >= 0 ? remainder.slice(nextHeaderOffset) : "";
	const lines = sectionBody
		.trim()
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean);
	const targetPrefix = `- [${label.trim()}](`;
	const targetMatch = `](${target.trim()})`;
	const existingIndex = lines.findIndex((line) => line.startsWith(targetPrefix) || line.includes(targetMatch));
	if (existingIndex >= 0) {
		lines[existingIndex] = entry;
	} else {
		lines.push(entry);
	}

	return `${toc.slice(0, start)}${heading}\n\n${lines.join("\n")}\n${rest}`.trimEnd() + "\n";
};

const parseLinks = async (): Promise<LinkRow[]> => {
	const raw = await readText(PIWORK_LINKS_FILE, LINKS_HEADER);
	const lines = raw.trim().split("\n").filter(Boolean);
	if (lines.length <= 1) return [];
	return lines.slice(1).map((line) => {
		const [created_at = "", last_seen_at = "", url = "", title = "", summary = "", tags = "", chat_id = ""] = parseCsvLine(line);
		return { created_at, last_seen_at, url, title, summary, tags, chat_id };
	});
};

const serializeLinks = (rows: LinkRow[]): string =>
	[
		LINKS_HEADER.trimEnd(),
		...rows.map((row) =>
			[
				row.created_at,
				row.last_seen_at,
				row.url,
				row.title,
				row.summary,
				row.tags,
				row.chat_id,
			].map(escapeCsv).join(","),
		),
	].join("\n") + "\n";

export const getPiworkHomeFilePaths = (): PiworkHomeFilePaths => ({ ...HOME_FILE_PATHS });

export const ensurePiworkHomeFiles = async (): Promise<void> => {
	await mkdir(PIWORK_DAILY_DIR, { recursive: true });

	if (!(await fileExists(PIWORK_MEMORY_FILE))) {
		await writeText(PIWORK_MEMORY_FILE, MEMORY_TEMPLATE);
	}
	if (!(await fileExists(PIWORK_TOC_FILE))) {
		await writeText(PIWORK_TOC_FILE, TOC_TEMPLATE);
	}
	if (!(await fileExists(PIWORK_LINKS_FILE))) {
		await writeText(PIWORK_LINKS_FILE, LINKS_HEADER);
	}
	const todayPath = dailyFilePath();
	if (!(await fileExists(todayPath))) {
		await writeText(todayPath, `# ${basename(todayPath, ".md")}\n\n`);
	}
};

export const readMemory = async (): Promise<string> =>
	readText(PIWORK_MEMORY_FILE, MEMORY_TEMPLATE);

export const rememberFact = async (section: MemorySection, fact: string): Promise<string> => {
	const content = await readMemory();
	const next = upsertBulletInSection(content, section, fact);
	await writeText(PIWORK_MEMORY_FILE, next);
	return next;
};

export const readToc = async (): Promise<string> =>
	readText(PIWORK_TOC_FILE, TOC_TEMPLATE);

export const upsertTocEntry = async (input: {
	section?: string;
	label: string;
	target: string;
	description?: string;
}): Promise<string> => {
	const content = await readToc();
	const next = upsertTocLine(content, input.section ?? "General", input.label, input.target, input.description);
	await writeText(PIWORK_TOC_FILE, next);
	return next;
};

export const readLinks = async (): Promise<LinkRow[]> => parseLinks();

export const upsertLink = async (input: {
	url: string;
	title?: string;
	summary?: string;
	tags?: string[];
	chatId?: string;
}): Promise<LinkRow[]> => {
	const now = new Date().toISOString();
	const normalizedUrl = normalizeUrl(input.url);
	const rows = await parseLinks();
	const existing = rows.find((row) => normalizeUrl(row.url) === normalizedUrl);
	if (existing) {
		existing.last_seen_at = now;
		if (input.title?.trim()) existing.title = input.title.trim();
		if (input.summary?.trim()) existing.summary = input.summary.trim();
		const mergedTags = normalizeTags([...normalizeTags(existing.tags), ...(input.tags ?? [])]);
		existing.tags = mergedTags.join("|");
		if (input.chatId?.trim()) existing.chat_id = input.chatId.trim();
	} else {
		rows.push({
			created_at: now,
			last_seen_at: now,
			url: normalizedUrl,
			title: input.title?.trim() ?? "",
			summary: input.summary?.trim() ?? "",
			tags: normalizeTags(input.tags).join("|"),
			chat_id: input.chatId?.trim() ?? "",
		});
	}
	await writeText(PIWORK_LINKS_FILE, serializeLinks(rows));
	return rows;
};

export const readDaily = async (date = getTodayStamp()): Promise<{ date: string; path: string; content: string }> => {
	const path = dailyFilePath(date);
	const fallback = `# ${date}\n\n`;
	const content = await readText(path, fallback);
	if (!(await fileExists(path))) {
		await writeText(path, fallback);
	}
	return { date, path, content };
};

export const appendDaily = async (input: {
	date?: string;
	section?: string;
	content: string;
}): Promise<{ date: string; path: string; content: string }> => {
	const date = input.date ?? getTodayStamp();
	const existing = await readDaily(date);
	const section = input.section?.trim();
	const entry = input.content.trim();
	if (!entry) return existing;

	let next = existing.content.trimEnd();
	if (!next) next = `# ${date}`;

	if (section) {
		const heading = `## ${section}`;
		if (!next.includes(heading)) {
			next += `\n\n${heading}\n`;
		}
		next += `\n- ${entry}`;
	} else {
		next += `\n\n- ${entry}`;
	}
	next += "\n";

	await writeText(existing.path, next);
	return { date, path: existing.path, content: next };
};
