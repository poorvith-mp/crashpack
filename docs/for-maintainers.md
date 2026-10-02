# Crashpack for Maintainers

Make contributor bug reports consistent, diagnosed, and safe to share in your GitHub issues.

## 1. Copy-Paste Issue Template Snippet

Add this section to your `.github/ISSUE_TEMPLATE/bug_report.md`:

```markdown
### Environment & Diagnostics

Run the following command in your terminal and paste the complete output below:

```bash
npx crashpack@0.4.2 --no-clipboard --stdout --template envinfo
```

> **Windows PowerShell:**
> ```powershell
> npx crashpack@0.4.2 --no-clipboard --stdout --template envinfo
> ```
```

This works across macOS, Linux, and Windows 11 / 10 without requiring any global installation.

---

## 2. Repo-Shipped Configuration (`.crashpackrc.json`)

You can commit a `.crashpackrc.json` file at the root of your repository. When a contributor or maintainer runs `npx crashpack`, Crashpack automatically walks up from their working directory to the git root and applies your configuration.

### Sample: Next.js / Full-Stack Web App

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

### Sample: CLI / Node Library

```json
{
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
| `sections` | `string[]` | Render allowlist, including `likely-cause`. Default/minimal follow its order; envinfo keeps its fixed headings. It does not limit collection or JSON. |
| `$schema` | `string` | Optional nonempty metadata. Crashpack never fetches this URL. |
| `sourcemaps` | `boolean` | Resolve stack traces in logs using local source maps (default `true`). |
| `heuristics` | `boolean` | Detect known package/runtime version mismatches (default `true`). |
| `only` | `string[]` | Limit collection strictly to these collectors. |
| `skip` | `string[]` | Skip specific collectors. |
| `redactExtra` | `string[]` | Additional regex patterns to redact. |
| `lines` | `number` | Maximum lines of logs to retain (default 200). |
| `clipboard` | `boolean` | Whether to copy to clipboard (default `true`). |
| `out` | `string` | File path to write the markdown report. |

---

## 3. Privacy Boundaries

Review the report before sharing; redaction reduces accidental disclosure but doesn't certify it as safe.

- **Network Boundaries**: Installed ordinary collection has no telemetry or automatic report upload. Ports use loopback TCP; Docker can contact a configured remote daemon. Wrapped commands have their own network behavior. Opening an issue URL or confirming `--issue --create` shares its contents externally.
- **Sensitive Token Stripping**: Built-in and optional entropy patterns mask matching values. Unknown secrets, personal information, source code and metadata can remain; a zero redaction count isn't a safety guarantee.
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
