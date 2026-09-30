<p align="center"><img src="https://raw.githubusercontent.com/poorvith-mp/crashpack/main/docs/assets/logo.svg" width="72" height="72" alt="Crashpack"></p>

# Crashpack

Collect the context around a crash into a clean, diagnosed Markdown report: logs, git state, system details, runtimes, packages, Docker, ports, and environment key names. Built by [Poorvith M P](https://github.com/poorvith-mp).

[Website](https://crashpack.poorvithmp.com) · [Maintainer Guide](docs/for-maintainers.md) · [Full guide](https://crashpack.poorvithmp.com/guide) · [Sample report](docs/sample-report.md) · [Contributing](CONTRIBUTING.md)

![Crashpack website preview](https://raw.githubusercontent.com/poorvith-mp/crashpack/main/docs/assets/site-preview.png)

## Start here

Node.js 20 or newer is required. This source release is **0.4.0**. The commands below pin that version; [npm release history](https://www.npmjs.com/package/crashpack?activeTab=versions) records published versions separately from git tags.

```sh
npx crashpack@0.4.0 --no-clipboard --out crash-report.md
```

Or install it once:

```sh
npm install -g crashpack@0.4.0
crashpack --no-clipboard --out crash-report.md
```

Installation and `npx` may download packages. Installed collection runs offline by default, with the network boundaries below. Read the saved report before sharing it. Clipboard copying is on by default; `--no-clipboard` keeps review deliberate. Default runs also save a temporary Markdown file outside the repository.

## What the report diagnoses

Crashpack v0.4.0 does not just dump context — it diagnoses:

- **Version-Mismatch Heuristics**: Analyzes installed dependencies and detected runtimes against 26 upstream compatibility rules (Next.js vs React, Vite vs Node, Angular vs TypeScript, etc.) and places a **Likely Cause** block at the top of the report. Disable with `--no-heuristics`.
- **Offline Sourcemap Resolution**: Automatically rewrites minified or bundled stack frames in captured logs to their original source files and lines (`src/app/page.tsx:42:7 [from bundle.js:1:48213]`). Never fetches over the network, protects against path traversal, and re-sanitizes resolved file paths. Disable with `--no-sourcemaps`.
- **Windows 11 Native Correctness**: Correctly detects Windows 11 (build ≥ 22000), avoids deprecated `wmic`, and uses fast PowerShell `Get-NetTCPConnection` with strict 3-second timeouts.

## For maintainers

Maintainers can drop Crashpack into GitHub issue templates in place of `npx envinfo` for identical heading compatibility plus captured logs and diagnosis:

```markdown
### Environment & Diagnostics
Run `npx crashpack@0.4 --no-clipboard --stdout --template envinfo` and paste output below.
```

See the complete [Maintainer Guide](docs/for-maintainers.md) for sample repository configs (`.crashpackrc.json`), redaction guarantees, and the official composite GitHub Action [`poorvith-mp/crashpack-action`](https://github.com/poorvith-mp/crashpack-action).

## Common workflows

```sh
# Drop-in envinfo template output
crashpack --template envinfo --stdout --no-clipboard

# Minimal summary: System, Runtimes, and Logs only
crashpack --template minimal --stdout --no-clipboard

# Collect if a command exits unsuccessfully
crashpack --wrap "npm test" --no-clipboard

# Read logs from a pipe
npm test 2>&1 | crashpack --stdin --no-clipboard

# JSON section text has passed through redaction
crashpack --json

# Print a prefilled URL without opening it or uploading
crashpack --issue --no-clipboard

# Review, enter a title, and explicitly confirm a GitHub upload
crashpack --issue --create --no-clipboard --out crash-report.md
```

`--wrap` runs through a shell and streams the child's output live, **unredacted**, to stderr. It waits for the child to exit; a successful child produces no report. Default collection can't recover past terminal logs: use `--stdin` or `--wrap`.

`--issue --create` requires GitHub CLI authentication and an interactive terminal. It saves a local report, displays the full report, and requires an explicit `yes` before uploading. It never uploads with `--stdin`, `--stdout`, `--json`, or noninteractive input. GitLab supports URL mode only. See [recovery and limits](https://crashpack.poorvithmp.com/guide#workflows).

## Configuration

Commit a `.crashpackrc.json` at your repository root. Crashpack automatically discovers it from any subfolder by walking up to the git root:

```json
{
  "template": "envinfo",
  "issueTitlePrefix": "[bug] ",
  "sections": ["system", "runtimes", "packages", "logs", "git"],
  "sourcemaps": true,
  "heuristics": true,
  "skip": ["docker", "ports"]
}
```

CLI flags override individual fields. The first existing configuration wins (nearest to current directory up to git root), without merging. Supported files: `.crashpackrc`, `.crashpackrc.json`, `.crashpackrc.toml`, legacy `crashpack.config.json`, then `package.json`'s `crashpack` field. [Full flags, TOML, and custom redaction](https://crashpack.poorvithmp.com/guide#configuration).

## Privacy and limits

The environment collector reads supported `.env` files in memory and emits key names only. Values appearing in logs or diffs are handled by heuristic redaction. Unknown secrets, personal information, source code, paths, and project metadata can remain. A redaction count of zero doesn't establish that a report is safe.

Ports are tested with loopback TCP connections. Docker CLI probes can contact a configured remote daemon. A wrapped command has its own network behavior. Opening an issue URL sends its contents to the destination; confirming `--create` uploads through `gh`. Clipboard history or sync can retain copied reports. There is no blanket guarantee that no data leaves the machine.

See the [privacy guide](https://crashpack.poorvithmp.com/guide#privacy) and [security policy](SECURITY.md). Report credential leaks privately.

## Optional sponsorship

Crashpack is free to use. You can [sponsor my work](https://razorpay.me/@poorvithmp) through the website's About section or footer. The hosted page opens only when you choose the link; there's no payment SDK, tracking, or payment requirement.

After saving a report in a successful interactive run, the CLI prints one optional sponsorship link to stderr. It doesn't add promotion to reports or clipboard contents, open a browser, or wait for input. The message is suppressed for redirected streams, `--stdin`, `--stdout`, `--json`, CI, failed wrapped commands, file-write fallback, and `--create`. Library calls don't show it.

## From source

```sh
git clone https://github.com/poorvith-mp/crashpack.git
cd crashpack
npm ci
npm run typecheck
npm test
npm run build
node dist/cli.js --help
```

The checked-out source version and npm availability are separate. `node dist/cli.js --version` reports the built package version. Library use, agent workflows, and site maintenance are in the [guide](https://crashpack.poorvithmp.com/guide#architecture).

MIT licensed. See [LICENSE](LICENSE) and [CHANGELOG](CHANGELOG.md).
