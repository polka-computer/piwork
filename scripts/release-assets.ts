import { spawnSync } from "node:child_process";
import {
	copyFileSync,
	existsSync,
	mkdtempSync,
	mkdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import pngToIco from "png-to-ico";

const PROJECT_ROOT = join(import.meta.dir, "..");
const SOURCE_PNG = join(PROJECT_ROOT, "assets", "piwork-icon.png");
const SOURCE_ICONSET_DIR = join(PROJECT_ROOT, "assets", "piwork", "icon.iconset");
const RELEASE_ASSET_DIR = join(PROJECT_ROOT, "build", "release-assets");
const MAC_ICONSET_DIR = join(RELEASE_ASSET_DIR, "mac", "icon.iconset");
const MAC_ICNS_PATH = join(RELEASE_ASSET_DIR, "mac", "AppIcon.icns");
const LINUX_ICON_PATH = join(RELEASE_ASSET_DIR, "linux", "piwork.png");
const WINDOWS_ICON_PATH = join(RELEASE_ASSET_DIR, "win", "piwork.ico");

const ICONSET_FILES = [
	"icon_16x16.png",
	"icon_16x16@2x.png",
	"icon_32x32.png",
	"icon_32x32@2x.png",
	"icon_128x128.png",
	"icon_128x128@2x.png",
	"icon_256x256.png",
	"icon_256x256@2x.png",
	"icon_512x512.png",
	"icon_512x512@2x.png",
] as const;

const WINDOWS_ICON_INPUTS = [
	"icon_16x16.png",
	"icon_32x32.png",
	"icon_128x128.png",
	"icon_256x256.png",
] as const;

const ensureDir = (path: string) => mkdirSync(path, { recursive: true });

const runShell = (script: string) => {
	const result = spawnSync("/bin/bash", ["-lc", script], {
		stdio: ["ignore", "pipe", "pipe"],
	});
	if (result.status !== 0) {
		const stderr = result.stderr?.toString().trim();
		throw new Error(
			stderr ? `Release asset command failed: ${stderr}` : "Release asset command failed",
		);
	}
	return result.stdout?.toString() ?? "";
};

const escapeForShell = (value: string) => `'${value.replace(/'/g, `'\\''`)}'`;

const sourceIconsetPath = (name: string) => join(SOURCE_ICONSET_DIR, name);

const ensureSourcePng = () => {
	if (!existsSync(SOURCE_PNG)) {
		throw new Error(`Missing source release icon: ${SOURCE_PNG}`);
	}
};

const ensureMacIconset = () => {
	ensureDir(join(RELEASE_ASSET_DIR, "mac"));
	rmSync(MAC_ICONSET_DIR, { recursive: true, force: true });
	ensureDir(MAC_ICONSET_DIR);

	for (const fileName of ICONSET_FILES) {
		const sourcePath = sourceIconsetPath(fileName);
		if (!existsSync(sourcePath)) {
			throw new Error(`Missing iconset asset: ${sourcePath}`);
		}
		copyFileSync(sourcePath, join(MAC_ICONSET_DIR, fileName));
	}
};

const extractIcnsHex = (rezOutput: string): string => {
	const matches = [...rezOutput.matchAll(/\$"([0-9A-Fa-f\s]+)"/g)];
	if (matches.length === 0) {
		throw new Error("DeRez did not emit any icns resource data.");
	}
	return matches.map((match) => match[1].replace(/\s+/g, "")).join("");
};

const ensureMacIcns = () => {
	if (process.platform !== "darwin") return;

	ensureDir(join(RELEASE_ASSET_DIR, "mac"));
	const tempDir = mkdtempSync(join(tmpdir(), "piwork-icon-"));
	const tempPngPath = join(tempDir, "piwork-icon.png");
	const tempRezPath = join(tempDir, "piwork-icon.rsrc");

	try {
		copyFileSync(SOURCE_PNG, tempPngPath);
		runShell(
			`sips -i ${escapeForShell(tempPngPath)} >/dev/null && DeRez -only icns ${escapeForShell(tempPngPath)} > ${escapeForShell(tempRezPath)}`,
		);
		const rezOutput = readFileSync(tempRezPath, "utf8");
		const icnsBytes = Buffer.from(extractIcnsHex(rezOutput), "hex");
		if (icnsBytes.length === 0) {
			throw new Error("Generated AppIcon.icns was empty.");
		}
		writeFileSync(MAC_ICNS_PATH, icnsBytes);
	} finally {
		rmSync(tempDir, { recursive: true, force: true });
	}
};

const ensureLinuxIcon = () => {
	ensureDir(join(RELEASE_ASSET_DIR, "linux"));
	copyFileSync(SOURCE_PNG, LINUX_ICON_PATH);
};

const ensureWindowsIcon = async () => {
	ensureDir(join(RELEASE_ASSET_DIR, "win"));
	const iconInputs = WINDOWS_ICON_INPUTS
		.map((fileName) => sourceIconsetPath(fileName))
		.filter((path) => existsSync(path));
	const icoBuffer = await pngToIco(iconInputs.length > 0 ? iconInputs : [SOURCE_PNG]);
	writeFileSync(WINDOWS_ICON_PATH, icoBuffer);
};

export const releaseAssetPaths = {
	sourcePng: SOURCE_PNG,
	sourceIconsetDir: SOURCE_ICONSET_DIR,
	macIconsetDir: MAC_ICONSET_DIR,
	macIcnsPath: MAC_ICNS_PATH,
	linuxIconPath: LINUX_ICON_PATH,
	windowsIconPath: WINDOWS_ICON_PATH,
};

export const ensureReleaseAssets = async () => {
	ensureSourcePng();
	rmSync(RELEASE_ASSET_DIR, { recursive: true, force: true });
	ensureMacIconset();
	ensureLinuxIcon();
	await ensureWindowsIcon();
	ensureMacIcns();
};
