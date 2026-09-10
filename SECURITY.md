# Security policy

## Supported versions

Security fixes target the current 0.3.x source release line. Older versions aren't maintained with parallel backports. Check [npm](https://www.npmjs.com/package/crashpack) and [releases](https://github.com/poorvith-mp/crashpack/releases) for published availability; a source version doesn't establish completed publication.

## Report handling and limits

Collector content and unavailable reasons pass through heuristic redaction before Markdown and JSON output. TypeScript's `RawText` and `SafeText` brands help maintain that pipeline. They don't prove text is free of secrets; top-level metadata also needs review. Unknown tokens, personal information, source code, paths, and identifiers may remain. Zero redactions means no rules matched.

The environment collector reads supported `.env` files into memory and emits only key names. It doesn't intentionally emit their values. Those values may appear in logs and diffs, where redaction depends on matching rules. Custom regular expressions can miss content, over-redact it, or consume excessive CPU. Syntax validation isn't a performance guarantee.

Installed collection is offline by default and has no telemetry. Port probes use loopback TCP. Docker may contact a configured remote daemon. Wrapped commands execute in a shell with their own network behavior and stream live, unredacted output to stderr. Installation and `npx` may download packages.

`--issue` constructs a URL locally; opening it shares encoded content with GitHub or GitLab. `--issue --create` saves the full report, displays it in an interactive terminal, asks for a title, and requires explicit confirmation before a GitHub upload through authenticated `gh`. Stdin, machine-output, and non-TTY modes don't upload. Oversized reports remain intact for manual recovery. Check existing issues before retrying an ambiguous upload failure.

Clipboard copying is enabled by default and can interact with clipboard history or sync. Use `--no-clipboard`, review reports, and remove local copies when no longer needed. File creation requests mode `0600`; actual access depends on the OS and existing permissions. Crashpack cannot guarantee that no data leaves the machine.

## Reporting a vulnerability or redaction bypass

Don't post credentials or private reports in public issues. Use [GitHub Private Vulnerability Reporting](https://github.com/poorvith-mp/crashpack/security/advisories/new) or email [poorvith007@proton.me](mailto:poorvith007@proton.me).

Include Crashpack and Node.js versions, relevant flags/configuration, expected behavior, and a minimal synthetic reproduction. If a real credential was exposed, revoke or rotate it through its provider; deleting a report doesn't invalidate it.

Automated checks use synthetic fixtures and mocked upload paths. They test known cases and don't certify that arbitrary reports are safe to share.
