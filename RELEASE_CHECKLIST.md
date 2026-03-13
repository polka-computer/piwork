# PiWork Release Checklist

## Before building

- `bun install`
- local mac release path: `bun run release:mac`
- local packaging is mac-first; Linux/Windows release packaging happens in GitHub Actions on native runners
- optional local secrets: copy `.env.example` to `.env` or `.env.local`
- confirm the PiWork icon sources are present:
  - `assets/piwork-icon.png`
  - `assets/piwork/icon.iconset`
- confirm macOS signing env vars are set if shipping signed mac builds
- for tagged stable releases, confirm GitHub Releases is the artifact host and `RELEASE_BASE_URL` resolves to `https://github.com/<repo>/releases/latest/download`

## Build outputs

- local mac: run `bun run release:mac`
- CI stable release: run the `Build and Release` workflow or push a `v*` tag
- confirm the `artifacts/` directory contains:
  - installer artifact
  - update metadata JSON
  - compressed app tarball
  - release manifest JSON

## Publish

- for stable tagged releases, GitHub Actions publishes the merged `artifacts/` contents to GitHub Releases
- for manual workflow runs, download the uploaded workflow artifacts for inspection
- keep old patch files in place for incremental updates
- verify the hosted `*-update.json` matches the latest build

## Smoke test

- install the packaged app
- confirm the app opens normally
- confirm PiWork shows the correct version/channel in Settings
- run “Check for Updates”
- if a newer build exists, verify “Download Update” then “Install and Relaunch”
