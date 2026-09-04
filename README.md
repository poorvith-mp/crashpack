# crashpack

> Everything your bug report needs, in one command. Built by Poorvith.

[![npm version](https://img.shields.io/npm/v/crashpack.svg)](https://www.npmjs.com/package/crashpack)
[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg)](https://opensource.org/licenses/MIT)
[![Node 20+](https://img.shields.io/badge/Node-20%2B-blue.svg)](https://nodejs.org)

When something breaks in local development, filing a useful bug report means manually gathering logs, git state, package versions, OS info, Docker status, and env config. It takes ten minutes, people skip half of it, and the resulting issue is unactionable.

**crashpack** is a local-first, zero-config CLI that collects your complete runtime context and outputs a single markdown report ready to paste into GitHub, Slack, or an AI coding agent.

---

## Key Guarantees

- **Zero Network Calls:** No cloud upload, no telemetry, no version check, no tracking. Nothing ever leaves your machine. Port detection opens loopback TCP connections to `127.0.0.1` only — nothing is sent, and no non-local socket is ever opened.
- **Mandatory Redaction:** Redaction is an architectural pass-through between raw collectors and output, enforced by the type system — collectors emit `RawText` and only the redactor can produce the `SafeText` the renderer accepts. AWS, Stripe, GitHub, GitLab, OpenAI, Anthropic, Google, SendGrid, Slack, Twilio and npm credentials, private keys, database passwords, JWTs and basic-auth URLs are stripped automatically, plus a high-entropy fallback for token shapes not on that list.
- **Environment Safety:** Only env key names are listed (`Keys: DATABASE_URL, STRIPE_KEY`). Env values are parsed in memory to extract key names and are **never** written to the report, stored, or exposed.
- **Fast:** Typically under two seconds. Collectors run in parallel under a 2-second per-command timeout and a 5-second hard ceiling.

---

## Quick Start

Run directly via `npx` in any project folder:

```bash
npx crashpack
```

The report is automatically copied to your clipboard and saved to a temporary file outside your repository (e.g. `/tmp/crashpack-2026-08-17-1422.md`).

---

## Usage & Workflows

### 1. Post-Crash Collection (Default)

Run immediately after a crash:

```bash
npx crashpack
```

### 2. GitHub Issue Pre-Fill (`--issue`)

Generate a one-click GitHub Issue creation link from your detected remote:

```bash
npx crashpack --issue
```

### 3. Command Wrapper Mode (`--wrap`)

Run your command with live output streaming. If the command succeeds (`exit 0`), nothing extra happens. If it fails, crashpack buffers the last 200 lines and generates a crash report:

```bash
npx crashpack --wrap "npm run dev"
npx crashpack --wrap "pytest tests/"
```

### 4. Piped Stdin Mode (`--stdin`)

Pipe standard error/output into crashpack:

```bash
npm run dev 2>&1 | npx crashpack --stdin
```

---

## CLI Flags

| Flag | Description |
|---|---|
| `(default)` | Collect all, copy to clipboard, print temp file path |
| `--wrap "<cmd>"` | Run command live, capture context on non-zero exit |
| `--stdin` | Read piped input as the log section |
| `--issue` | Generate a GitHub or GitLab issue pre-fill URL for this repository |
| `--since <duration>` | Filter git commits since duration (e.g. `1h`, `1d`) |
| `--stdout` | Print the markdown report directly to stdout |
| `--json` | Emit raw JSON `CrashPack` object |
| `--out <path>` | Write markdown to a specific file instead of temp |
| `--no-clipboard` | Skip copying to clipboard |
| `--lines <n>` | Number of log lines to capture (default `200`) |
| `--only <ids>` | Run only specific collectors (e.g. `--only git,system`) |
| `--skip <ids>` | Skip specific collectors (e.g. `--skip docker,ports`) |
| `--redact-extra <regex>` | Additional user-supplied regex patterns to redact |
| `--no-entropy` | Disable the generic high-entropy token fallback |

---

## Sample Output

```markdown
# crashpack · my-project
_2026-08-17 14:22 UTC · collected in 1.2s · 4 values redacted_

## Logs

[last 200 lines, redacted]

## Git
- Branch: `feat/checkout-redesign`
- Remote: `github.com/user/my-project`
- Uncommitted changes: 3 files

**Last 3 commits**
- `a1b2c3d` fix: handle null customer — 2 hours ago
- `d4e5f6a` feat: add webhook handler — 1 day ago
- `b7c8d9e` chore: bump deps — 2 days ago

**Diff**
```diff
+ const customerId = session.metadata.customer_id;
- const customerId = session.customer;
```

## System
| | |
|---|---|
| OS | macOS 14.5 (arm64) |
| CPU | Apple M2, 8 cores |
| Memory | 4.2 GB free of 16 GB |
| Disk | 82 GB free of 494 GB |

## Runtimes
- Node `20.11.0`
- Python `3.11.7`

## Packages
| Package | Version |
|---|---|
| next | 15.4.2 |
| react | 19.0.0 |
_...and 42 more_

_Installed versions are read from `node_modules`; the first 20 packages are shown._

## Docker
- Daemon: running
- `postgres` — up 2 hours (healthy)
- `redis` — exited (137) 4 minutes ago  ← likely relevant

## Ports
- `3000` — dev/node
- `5432` — postgres

## Environment
_12 keys present. Values redacted. Keys: DATABASE_URL, STRIPE_SECRET_KEY, ..._

---
_Generated by crashpack · Built by Poorvith. No data left this machine._
```

---

## Development

```bash
# Install dependencies
npm install

# Run test suite
npm test

# Build ESM & CJS distribution
npm run build
```

---

## Community & Security

- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Security Policy](SECURITY.md)
- [Contributing Guide](CONTRIBUTING.md)

---

## License

[MIT](LICENSE) © [Poorvith M P](https://github.com/poorvith-mp)
