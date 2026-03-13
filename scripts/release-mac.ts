import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { loadLocalEnv } from "./local-env";

loadLocalEnv();

const MIN_FREE_BYTES = 4 * 1024 * 1024 * 1024;

const formatBytes = (bytes: number) => {
	const gib = bytes / (1024 * 1024 * 1024);
	return `${gib.toFixed(gib >= 10 ? 0 : 1)} GiB`;
};

const getAvailableBytes = () => {
	const result = spawnSync("df", ["-Pk", process.cwd()], {
		stdio: ["ignore", "pipe", "pipe"],
	});
	if (result.status !== 0) {
		const stderr = result.stderr?.toString().trim();
		throw new Error(stderr || "Failed to check free disk space.");
	}

	const [, dataLine] = result.stdout.toString().trim().split("\n");
	const columns = dataLine?.trim().split(/\s+/) ?? [];
	const availableBlocks = Number(columns[3]);
	if (!Number.isFinite(availableBlocks)) {
		throw new Error("Could not parse available disk space from df output.");
	}
	return availableBlocks * 1024;
};

if (process.platform !== "darwin") {
	console.error("[piwork:release] release:mac only runs on macOS.");
	process.exit(1);
}

const hasMacSigningEnv = Boolean(
	process.env.ELECTROBUN_DEVELOPER_ID
	&& process.env.ELECTROBUN_TEAMID
	&& process.env.ELECTROBUN_APPLEID
	&& process.env.ELECTROBUN_APPLEIDPASS,
);

const availableBytes = getAvailableBytes();
console.log(
	`[piwork:release] mac signing: ${hasMacSigningEnv ? "enabled" : "disabled"} (${hasMacSigningEnv ? "Apple credentials present" : "missing Apple credentials"})`,
);
console.log(
	`[piwork:release] free disk space: ${formatBytes(availableBytes)} available, ${formatBytes(MIN_FREE_BYTES)} required`,
);

if (availableBytes < MIN_FREE_BYTES) {
	console.error(
		"[piwork:release] not enough free disk space for a stable mac release. Clear space before retrying.",
	);
	process.exit(1);
}

// --- Build (with codesign, without notarization) ---
// We handle notarization ourselves after signing native .node files.
process.env.PIWORK_SKIP_NOTARIZE = "1";

const buildResult = spawnSync(process.execPath, ["run", "build:stable"], {
	cwd: process.cwd(),
	env: process.env,
	stdio: "inherit",
});

if (!hasMacSigningEnv) {
	if (buildResult.status !== 0) {
		console.error("[piwork:release] build failed.");
		process.exit(1);
	}
	console.log("[piwork:release] signing disabled — skipping native signing and notarization.");
	process.exit(0);
}

// --- Locate bundle ---
// The build may exit non-zero from a late step (e.g. DMG creation) even though
// the .app was fully built and signed. Check for the bundle before giving up.
const developerId = process.env.ELECTROBUN_DEVELOPER_ID!;
const arch = process.arch === "arm64" ? "arm64" : "x64";
const buildDir = join(process.cwd(), "build", `stable-macos-${arch}`);
const bundlePath = join(buildDir, "piwork.app");

if (!existsSync(bundlePath)) {
	console.error(`[piwork:release] app bundle not found at ${bundlePath}`);
	process.exit(1);
}

if (buildResult.status !== 0) {
	console.warn("[piwork:release] build exited with errors but app bundle exists — continuing with signing and notarization.");
}

console.log(`[piwork:release] bundle: ${bundlePath}`);

// --- Prune and sign native .node files ---
const nativeDir = join(bundlePath, "Contents", "Resources", "app", "native");

if (existsSync(nativeDir)) {
	const allowedFiles = arch === "x64"
		? new Set(["pi_natives.darwin-x64-baseline.node", "pi_natives.darwin-x64-modern.node"])
		: new Set(["pi_natives.darwin-arm64.node"]);

	console.log(`[piwork:release] pruning natives for ${arch}`);

	for (const entry of readdirSync(nativeDir)) {
		if (!entry.startsWith("pi_natives.") || !entry.endsWith(".node")) continue;

		const entryPath = join(nativeDir, entry);
		if (!allowedFiles.has(entry)) {
			rmSync(entryPath, { force: true });
			console.log(`[piwork:release]   pruned ${entry}`);
			continue;
		}

		const signResult = spawnSync("codesign", [
			"--force", "--verbose", "--timestamp",
			"--sign", developerId,
			"--options", "runtime",
			entryPath,
		], { stdio: ["ignore", "pipe", "pipe"] });

		if (signResult.status !== 0) {
			const stderr = signResult.stderr?.toString().trim();
			console.error(stderr);
			console.error(`[piwork:release] codesign failed for ${entry}`);
			process.exit(1);
		}

		const verifyResult = spawnSync("codesign", ["--verify", "--verbose", entryPath], {
			stdio: ["ignore", "pipe", "pipe"],
		});

		if (verifyResult.status !== 0) {
			console.error(`[piwork:release] signature verification failed for ${entry}`);
			process.exit(1);
		}

		console.log(`[piwork:release]   signed ${entry}`);
	}
} else {
	console.warn(`[piwork:release] native dir not found at ${nativeDir} — skipping native signing`);
}

// --- Re-sign app bundle to update seal with new .node signatures ---
console.log("[piwork:release] re-signing app bundle...");
const entitlementsPath = join(buildDir, "entitlements.plist");
const resignArgs = [
	"--force", "--verbose", "--timestamp",
	"--sign", developerId,
	"--options", "runtime",
	...(existsSync(entitlementsPath) ? ["--entitlements", entitlementsPath] : []),
	bundlePath,
];
const resignResult = spawnSync("codesign", resignArgs, { stdio: "inherit" });

if (resignResult.status !== 0) {
	console.error("[piwork:release] failed to re-sign app bundle.");
	process.exit(1);
}

// --- Notarize ---
console.log("[piwork:release] creating zip for notarization...");
const zipPath = `${bundlePath}.zip`;
rmSync(zipPath, { force: true });

const dittoResult = spawnSync("ditto", ["-c", "-k", "--keepParent", bundlePath, zipPath], {
	stdio: "inherit",
});

if (dittoResult.status !== 0) {
	console.error("[piwork:release] failed to create zip.");
	process.exit(1);
}

console.log("[piwork:release] submitting for notarization...");
const notarizeResult = spawnSync("xcrun", [
	"notarytool", "submit", zipPath,
	"--apple-id", process.env.ELECTROBUN_APPLEID!,
	"--password", process.env.ELECTROBUN_APPLEIDPASS!,
	"--team-id", process.env.ELECTROBUN_TEAMID!,
	"--wait",
], { stdio: "inherit" });

if (notarizeResult.status !== 0) {
	console.error("[piwork:release] notarization failed.");
	process.exit(1);
}

// --- Staple ---
console.log("[piwork:release] stapling notarization ticket...");
const stapleResult = spawnSync("xcrun", ["stapler", "staple", bundlePath], {
	stdio: "inherit",
});

if (stapleResult.status !== 0) {
	console.error("[piwork:release] stapling failed.");
	process.exit(1);
}

console.log("[piwork:release] release complete.");
