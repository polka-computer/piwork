import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ElectrobunConfig } from "electrobun";
import { loadLocalEnv } from "./scripts/local-env";

loadLocalEnv();

const packageJson = JSON.parse(
	readFileSync(join(import.meta.dir, "package.json"), "utf-8"),
) as { version?: string };

const releaseBaseUrl = process.env.RELEASE_BASE_URL
	|| (process.env.GITHUB_REPOSITORY
		? `https://github.com/${process.env.GITHUB_REPOSITORY}/releases/latest/download`
		: "");

const hasMacSigningEnv = Boolean(
	process.env.ELECTROBUN_DEVELOPER_ID
	&& process.env.ELECTROBUN_TEAMID
	&& process.env.ELECTROBUN_APPLEID
	&& process.env.ELECTROBUN_APPLEIDPASS,
);

export default {
	app: {
		name: "piwork",
		identifier: "com.longtaillabs.piwork",
		version: packageJson.version ?? "0.0.0",
	},
	build: {
		bun: {
			external: ["@tobilu/qmd"],
		},
		copy: {
			"dist/index.html": "views/mainview/index.html",
			"dist/assets": "views/mainview/assets",
			"node_modules/@oh-my-pi/pi-natives/native/pi_natives.darwin-arm64.node": "native/pi_natives.darwin-arm64.node",
			"node_modules/@tobilu/qmd": "node_modules/@tobilu/qmd",
		},
		watchIgnore: ["dist/**", "build/**", "artifacts/**"],
		scripts: {
			preBuild: "./scripts/prepare-release-assets.ts",
			postBuild: "./scripts/install-mac-app-icon.ts",
			postWrap: "./scripts/install-mac-app-icon.ts",
			postPackage: "./scripts/post-package.ts",
		},
		release: {
			baseUrl: releaseBaseUrl,
		},
		mac: {
			bundleCEF: false,
			icons: "assets/piwork/icon.iconset",
			codesign: hasMacSigningEnv,
			notarize: hasMacSigningEnv && process.env.PIWORK_SKIP_NOTARIZE !== "1",
		},
		linux: {
			bundleCEF: false,
			icon: "build/release-assets/linux/piwork.png",
		},
		win: {
			bundleCEF: false,
			icon: "build/release-assets/win/piwork.ico",
		},
	},
} satisfies ElectrobunConfig;
