<p align="center"><img src="https://raw.githubusercontent.com/poorvith-mp/crashpack/main/docs/assets/logo.svg" width="72" height="72" alt="Crashpack"></p>

# Crashpack

Collect the context around a crash into a Markdown report: logs, git state, system details, runtimes, packages, Docker, ports, and environment key names. Built by [Poorvith M P](https://github.com/poorvith-mp).

[Website](https://crashpack.poorvithmp.com) · [Full guide](https://crashpack.poorvithmp.com/guide) · [Sample report](docs/sample-report.md) · [Contributing](CONTRIBUTING.md)

![Crashpack website preview](https://raw.githubusercontent.com/poorvith-mp/crashpack/main/docs/assets/site-preview.png)

## Start here

Node.js 20 or newer is required. This source release is **0.3.0**. The commands below pin that version; [npm release history](https://www.npmjs.com/package/crashpack?activeTab=versions) records published versions separately from git tags.

```sh
npx crashpack@0.3.0 --no-clipboard --out crash-report.md
```

Or install it once:

```sh
npm install -g crashpack@0.3.0
crashpack --no-clipboard --out crash-report.md
```

Installation and `npx` may download packages. Installed collection runs offline by default, with the network boundaries below. Read the saved report before sharing it. Clipboard copying is on by default; `--no-clipboard` keeps review deliberate. Default runs also save a temporary Markdown file outside the repository.

## Common workflows

```sh
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

Create `.crashpackrc.json` in the directory where you run the CLI:

```json
{
  "skip": ["docker"],
  "lines": 200,
  "clipboard": false,
  "out": "crash-report.md"
}
```

CLI flags override individual fields. The first existing configuration wins, without merging or parent-directory lookup: `.crashpackrc`, `.crashpackrc.json`, `.crashpackrc.toml`, legacy `crashpack.config.json`, then `package.json`'s `crashpack` field. Invalid configuration fails before collection with exit code 2. [Full flags, TOML, and custom redaction](https://crashpack.poorvithmp.com/guide#configuration).

## Privacy and limits

The environment collector reads supported `.env` files in memory and emits key names only. Values appearing in logs or diffs are handled by heuristic redaction. Unknown secrets, personal information, source code, paths, and project metadata can remain. A redaction count of zero doesn't establish that a report is safe.

Ports are tested with loopback TCP connections. Docker CLI probes can contact a configured remote daemon. A wrapped command has its own network behavior. Opening an issue URL sends its contents to the destination; confirming `--create` uploads through `gh`. Clipboard history or sync can retain copied reports. There is no blanket guarantee that no data leaves the machine.

Crashpack gathers context; it doesn't diagnose dependency conflicts, resolve source maps, restart daemons, or capture memory dumps. Heuristics [#21](https://github.com/poorvith-mp/crashpack/issues/21), source maps [#23](https://github.com/poorvith-mp/crashpack/issues/23), and daemon memory work [#24](https://github.com/poorvith-mp/crashpack/issues/24) remain separate open designs.

See the [privacy guide](https://crashpack.poorvithmp.com/guide#privacy) and [security policy](SECURITY.md). Report credential leaks privately.

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
