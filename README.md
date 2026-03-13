# piwork

Chat-driven desktop app for working with your local files. Index read-only folders, reference them with `@alias` in chat, and store every generated artifact under `~/piwork`.

Built with [Electrobun](https://electrobun.dev) + React + Bun. Runs on macOS, Windows, and Linux.

## Download

Grab the latest release for your platform from [GitHub Releases](https://github.com/polka-computer/piwork/releases).

## Development

```bash
bun install
bun run dev:hmr
```

Other useful commands:

```bash
bun run build            # production build
bun run build:canary     # canary package
bun run build:stable     # stable package
bun run release:mac      # local macOS release (sign + notarize)
```

## Releasing

Pushes to `master` with a bumped `version` in `package.json` automatically create a tag, build all platforms, and publish to GitHub Releases.

```bash
# bump version in package.json, then:
git push origin master
# GitHub Actions handles the rest
```

You can also push a `v*` tag manually as a fallback.

For local macOS signing/notarization, copy `.env.example` to `.env` and fill in your Apple credentials.

## Structure

```text
src/bun/         Main process, runtime control, updater RPC
src/mainview/    React renderer
src/shared/      Typed RPC contracts and shared helpers
scripts/         Build/release helpers
```
