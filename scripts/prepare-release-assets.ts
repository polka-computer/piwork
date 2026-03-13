import { ensureReleaseAssets, releaseAssetPaths } from "./release-assets";

await ensureReleaseAssets();

console.log("[piwork:release] prepared release assets");
console.log(`[piwork:release] source png: ${releaseAssetPaths.sourcePng}`);
console.log(`[piwork:release] source iconset: ${releaseAssetPaths.sourceIconsetDir}`);
console.log(`[piwork:release] windows icon: ${releaseAssetPaths.windowsIconPath}`);
console.log(`[piwork:release] linux icon: ${releaseAssetPaths.linuxIconPath}`);
if (process.platform === "darwin") {
	console.log(`[piwork:release] mac icns: ${releaseAssetPaths.macIcnsPath}`);
}
