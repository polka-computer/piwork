import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { ensureReleaseAssets, releaseAssetPaths } from "./release-assets";

const getBundlePath = () => {
	const wrapperBundlePath = process.env.ELECTROBUN_WRAPPER_BUNDLE_PATH;
	if (wrapperBundlePath) return wrapperBundlePath;

	const buildDir = process.env.ELECTROBUN_BUILD_DIR;
	const appName = process.env.ELECTROBUN_APP_NAME;
	if (!buildDir || !appName) return undefined;

	return join(buildDir, `${appName}.app`);
};

const codesign = (path: string) => {
	const developerId = process.env.ELECTROBUN_DEVELOPER_ID;
	if (!developerId) {
		console.warn(`[piwork:release] ELECTROBUN_DEVELOPER_ID not set — skipping codesign for ${path}`);
		return;
	}

	const result = spawnSync(
		"codesign",
		["--force", "--verbose", "--timestamp", "--sign", developerId, "--options", "runtime", path],
		{ stdio: ["ignore", "pipe", "pipe"] },
	);

	if (result.status !== 0) {
		const stderr = result.stderr?.toString().trim();
		throw new Error(
			stderr ? `[piwork:release] codesign failed for ${path}: ${stderr}` : `[piwork:release] codesign failed for ${path}`,
		);
	}
};

const pruneAndSignMacNatives = (bundlePath: string) => {
	const targetArch = process.env.ELECTROBUN_ARCH === "x64" ? "x64" : "arm64";
	const nativeDir = join(bundlePath, "Contents", "Resources", "app", "native");

	console.log(`[piwork:release] pruning natives for ${targetArch} in ${nativeDir}`);

	if (!existsSync(nativeDir)) {
		console.warn("[piwork:release] native addon directory not found; skipping native pruning.");
		return;
	}

	const allowedFiles = targetArch === "x64"
		? new Set([
			"pi_natives.darwin-x64-baseline.node",
			"pi_natives.darwin-x64-modern.node",
		])
		: new Set(["pi_natives.darwin-arm64.node"]);

	for (const entry of readdirSync(nativeDir)) {
		if (!entry.startsWith("pi_natives.") || !entry.endsWith(".node")) continue;

		const entryPath = join(nativeDir, entry);
		if (!allowedFiles.has(entry)) {
			rmSync(entryPath, { force: true });
			console.log(`[piwork:release] pruned ${entry}`);
			continue;
		}

		codesign(entryPath);

		const verifyResult = spawnSync("codesign", ["--verify", "--verbose", entryPath], {
			stdio: ["ignore", "pipe", "pipe"],
		});
		if (verifyResult.status !== 0) {
			throw new Error(`[piwork:release] signature verification failed for ${entryPath}`);
		}

		console.log(`[piwork:release] signed ${entry}`);
	}
};

if (process.platform !== "darwin") {
	process.exit(0);
}

const bundlePath = getBundlePath();
console.log(`[piwork:release] resolved bundle path: ${bundlePath ?? "(not found)"}`);
if (!bundlePath || !existsSync(bundlePath)) {
	console.warn("[piwork:release] mac app bundle not found; skipping icon install.");
	process.exit(0);
}

await ensureReleaseAssets();

const resourcesDir = join(bundlePath, "Contents", "Resources");
mkdirSync(resourcesDir, { recursive: true });
copyFileSync(releaseAssetPaths.macIcnsPath, join(resourcesDir, "AppIcon.icns"));
pruneAndSignMacNatives(bundlePath);

console.log(`[piwork:release] finalized mac bundle resources in ${bundlePath}`);
