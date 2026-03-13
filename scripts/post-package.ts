import { mkdirSync } from "node:fs";
import { basename, join } from "node:path";

const artifactDir = process.env.ELECTROBUN_ARTIFACT_DIR;

if (!artifactDir) {
	console.warn("[piwork:release] ELECTROBUN_ARTIFACT_DIR is not set; skipping post-package manifest.");
	process.exit(0);
}

mkdirSync(artifactDir, { recursive: true });

const manifest = {
	appName: process.env.ELECTROBUN_APP_NAME ?? "PiWork",
	version: process.env.ELECTROBUN_APP_VERSION ?? "0.0.0",
	identifier: process.env.ELECTROBUN_APP_IDENTIFIER ?? "com.longtaillabs.piwork",
	buildEnv: process.env.ELECTROBUN_BUILD_ENV ?? "dev",
	os: process.env.ELECTROBUN_OS ?? "unknown",
	arch: process.env.ELECTROBUN_ARCH ?? "unknown",
	buildDir: process.env.ELECTROBUN_BUILD_DIR ? basename(process.env.ELECTROBUN_BUILD_DIR) : undefined,
	generatedAt: new Date().toISOString(),
};

await Bun.write(
	join(artifactDir, `${manifest.buildEnv}-${manifest.os}-${manifest.arch}-release-manifest.json`),
	`${JSON.stringify(manifest, null, 2)}\n`,
);

console.log(
	`[piwork:release] wrote release manifest for ${manifest.buildEnv}/${manifest.os}/${manifest.arch}`,
);
