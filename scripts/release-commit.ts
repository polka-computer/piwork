import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const pkgPath = join(root, "package.json");

// --- Emoji pool ---
const emojis = ["🥧", "🫐", "🫐", "🥧", "🫐"];
const pick = () => emojis[Math.floor(Math.random() * emojis.length)];

// --- Helpers ---
const run = (cmd: string, args: string[], opts?: { cwd?: string }) => {
	const r = spawnSync(cmd, args, { cwd: root, stdio: "pipe", ...opts });
	return r.stdout?.toString().trim() ?? "";
};

const fail = (msg: string): never => {
	console.error(`\n${pick()} ${msg}`);
	process.exit(1);
};

// --- Parse bump type from args ---
type Bump = "patch" | "minor" | "major";
const arg = process.argv[2] as string | undefined;
const bump: Bump = (arg === "minor" || arg === "major") ? arg : "patch";

// --- Collect staged files only ---
const modified = run("git", ["diff", "--cached", "--name-only"])
	.split("\n")
	.filter(Boolean);

if (modified.length === 0) {
	fail("No staged files to commit. Stage your changes with git add first.");
}

// --- Bump version ---
const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
const [major, minor, patch] = pkg.version.split(".").map(Number);
const newVersion =
	bump === "major" ? `${major + 1}.0.0` :
	bump === "minor" ? `${major}.${minor + 1}.0` :
	`${major}.${minor}.${patch + 1}`;

pkg.version = newVersion;
writeFileSync(pkgPath, `${JSON.stringify(pkg, null, "\t")}\n`);
console.log(`${pick()} version bump: ${pkg.version.replace(newVersion, "")}${newVersion}`);

// --- Get diff for Claude (staged only) ---
const diff = run("git", ["diff", "--cached"]);
const fileList = modified.join("\n");

// --- Generate commit message with Claude ---
console.log(`${pick()} asking Claude for a commit message...`);

const prompt = `You are writing a git commit message for the piwork desktop app.
Here are the modified files:
${fileList}

Here is the diff:
${diff}

Write a short conventional commit message. Rules:
- Single line only: an emoji (use 🥧 or 🫐), then a conventional prefix (feat:, fix:, chore:, style:, refactor:, docs:, test:, perf:), then a brief high-level summary, then (v${newVersion})
- No body, no bullet points, no details — just the one-liner
- Output ONLY the commit message, nothing else`;

const claudeResult = spawnSync("claude", ["-p", prompt], {
	cwd: root,
	stdio: "pipe",
	timeout: 30_000,
});

let commitMsg: string;

if (claudeResult.status !== 0 || !claudeResult.stdout?.toString().trim()) {
	console.warn(`${pick()} Claude unavailable, falling back to auto-generated message`);

	// Fallback: simple classification
	const classify = (file: string): string => {
		if (/\.(test|spec)\.[tj]sx?$/.test(file)) return "test";
		if (/^(README|CHANGELOG|docs\/)/i.test(file)) return "docs";
		if (/^(scripts\/|\.github\/|electrobun\.|vite\.config|tsconfig|postcss|tailwind)/i.test(file)) return "chore";
		if (/\.(css|scss)$/.test(file)) return "style";
		return "feat";
	};

	const groups = new Map<string, string[]>();
	for (const f of modified) {
		const type = classify(f);
		if (!groups.has(type)) groups.set(type, []);
		groups.get(type)!.push(f);
	}

	const prefixOrder = ["feat", "fix", "style", "test", "docs", "chore"];
	const dominant = prefixOrder.find((p) => groups.has(p)) ?? "chore";

	const summarize = (files: string[]): string =>
		files
			.map((f) => f.split("/").pop()!.replace(/\.[^.]+$/, ""))
			.slice(0, 4)
			.join(", ") + (files.length > 4 ? ` +${files.length - 4} more` : "");

	const headline = `${dominant}: ${summarize(modified)}`;
	const body = [...groups.entries()]
		.map(([type, files]) => `${pick()} ${type}: ${files.join(", ")}`)
		.join("\n");

	commitMsg = `${pick()} ${headline} (v${newVersion})\n\n${body}`;
} else {
	commitMsg = claudeResult.stdout.toString().trim();
}

console.log(`\n${pick()} commit message:\n---\n${commitMsg}\n---\n`);

// --- Stage package.json (version was bumped) ---
const addResult = spawnSync("git", ["add", "package.json"], { cwd: root, stdio: "inherit" });
if (addResult.status !== 0) fail("git add failed.");

// --- Commit ---
const commitResult = spawnSync("git", ["commit", "-m", commitMsg], {
	cwd: root,
	stdio: "inherit",
});
if (commitResult.status !== 0) fail("git commit failed.");

// --- Push ---
console.log(`\n${pick()} pushing to master...`);
const pushResult = spawnSync("git", ["push", "origin", "master"], {
	cwd: root,
	stdio: "inherit",
});
if (pushResult.status !== 0) fail("git push failed.");

console.log(`\n${pick()} released v${newVersion} ${pick()}`);
