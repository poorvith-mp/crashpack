# Crashpack for Maintainers

Make contributor bug reports consistent, diagnosed, and safe to share in your GitHub issues.

## 1. Copy-Paste Issue Template Snippet

Add this section to your `.github/ISSUE_TEMPLATE/bug_report.md`:

```markdown
### Environment & Diagnostics

Run the following command in your terminal and paste the complete output below:

```bash
npx crashpack@0.4 --no-clipboard --stdout --template envinfo
```

> **Windows PowerShell:**
> ```powershell
> npx crashpack@0.4 --no-clipboard --stdout --template envinfo
> ```
```

This works across macOS, Linux, and Windows 11 / 10 without requiring any global installation.

---

## 2. Repo-Shipped Configuration (`.crashpackrc.json`)

You can commit a `.crashpackrc.json` file at the root of your repository. When a contributor or maintainer runs `npx crashpack`, Crashpack automatically walks up from their working directory to the git root and applies your configuration.

### Sample: Next.js / Full-Stack Web App

```json
{
  "$schema": "https://crashpack.poorvithmp.com/schema.json",
  "template": "envinfo",
  "issueTitlePrefix": "[bug] ",
  "sections": ["system", "runtimes", "packages", "logs", "git"],
  "sourcemaps": true,
  "heuristics": true,
  "skip": ["docker", "ports"]
}
```

### Sample: CLI / Node Library

```json
{
  "$schema": "https://crashpack.poorvithmp.com/schema.json",
  "template": "minimal",
  "issueTitlePrefix": "[cli-bug] ",
  "sections": ["system", "runtimes", "logs"],
  "skip": ["docker", "ports", "env"]
}
```

### Configuration Options

| Option | Type | Description |
|---|---|---|
| `template` | `"default"` \| `"envinfo"` \| `"minimal"` | Report template format. |
| `issueTitlePrefix` | `string` | Prefix prepended to issue titles when using `--issue`. |
| `sections` | `string[]` | Ordered allowlist of collector IDs to render. |
| `sourcemaps` | `boolean` | Resolve stack traces in logs using local source maps (default `true`). |
| `heuristics` | `boolean` | Detect known package/runtime version mismatches (default `true`). |
| `only` | `string[]` | Limit collection strictly to these collectors. |
| `skip` | `string[]` | Skip specific collectors. |
| `redactExtra` | `string[]` | Additional regex patterns to redact. |
| `lines` | `number` | Maximum lines of logs to retain (default 200). |
| `clipboard` | `boolean` | Whether to copy to clipboard (default `true`). |
| `out` | `string` | File path to write the markdown report. |

---

## 3. Redaction Guarantee

Crashpack runs 100% locally and offline during collection:

- **Zero Outbound Telemetry**: No network requests are sent during collection or diagnosis. The only external network action is interactive GitHub issue creation via `--issue --create`, which requires explicit user consent.
- **Sensitive Token Stripping**: API keys, JWTs, bearer tokens, AWS credentials, private keys, database connection strings, and passwords are automatically redacted.
- **Path Sanitization**: User home directories (`/home/username` and `C:\Users\username`) are normalized to `~` or `<home>` tokens.
- **Environment Safety**: The `env` collector captures only variable names (keys), never their values.

---

## 4. GitHub Actions Integration

Capture rich diagnostic reports automatically when CI workflows fail using the official composite action:

```yaml
- name: Run Tests
  run: npm test

- name: Collect Crashpack Diagnostics on Failure
  if: failure()
  uses: poorvith-mp/crashpack-action@v1
  with:
    template: envinfo
```

When a job fails, the Crashpack report is rendered directly into the GitHub Actions Step Summary for immediate inspection.
