import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { ElectrobunConfig } from "electrobun";
import { loadLocalEnv } from "./scripts/local-env";

loadLocalEnv();

/** Recursively resolve QMD's transitive JS deps so they get copied into the bundle. */
const resolveQmdDepCopyRules = (): Record<string, string> => {
	const rules: Record<string, string> = {};
	const visited = new Set<string>();

	const resolve = (depName: string) => {
		if (visited.has(depName)) return;
		visited.add(depName);

		const pkgDir = join("node_modules", depName);
		const pkgPath = join(pkgDir, "package.json");
		if (!existsSync(pkgPath)) return;

		rules[pkgDir] = pkgDir;

		const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
		for (const sub of Object.keys(pkg.dependencies ?? {})) {
			resolve(sub);
		}
	};

	const qmdPkgPath = join("node_modules", "@tobilu", "qmd", "package.json");
	if (existsSync(qmdPkgPath)) {
		const qmdPkg = JSON.parse(readFileSync(qmdPkgPath, "utf-8"));
		for (const dep of Object.keys(qmdPkg.dependencies ?? {})) {
			resolve(dep);
		}
	}

	return rules;
};

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
			...resolveQmdDepCopyRules(),
		},
		watchIgnore: ["dist/**", "build/**", "artifacts/**"],
		scripts: {
			preBuild: "./scripts/prepare-release-assets.ts",
			postBuild: "./scripts/install-mac-app-icon.ts",
			postWrap: "./scripts/install-mac-app-icon.ts",
			postPackage: "./scripts/post-package.ts",
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
	release: {
		baseUrl: releaseBaseUrl,
	},
} satisfies ElectrobunConfig;
