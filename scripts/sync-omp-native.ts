import { cp, rm, stat } from "node:fs/promises";
import { join } from "node:path";

const sourceDir = join(process.cwd(), "node_modules", "@oh-my-pi", "pi-natives", "native");
const targetDir = join(process.cwd(), "native");

try {
	await stat(sourceDir);
} catch {
	console.error(`slide: missing OMP native addon directory at ${sourceDir}`);
	process.exit(1);
}

await rm(targetDir, { recursive: true, force: true });
await cp(sourceDir, targetDir, { recursive: true });

console.log(`slide: synced OMP native addons to ${targetDir}`);
