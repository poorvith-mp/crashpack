# Changelog

## 0.4.2 — 2026-10-02

### Fixed

- Wrapped output capture retains logical UTF-8 lines across split writes, CRLF boundaries and unterminated tails without changing live stderr bytes.
- Local source maps resolve raw frames before public redaction, respect the remaining analysis budget, and keep resolved home paths sanitized on Windows, Linux and macOS.
- Compatibility findings require verified installed versions. Next.js 15 no longer triggers a blanket React 19 requirement; Vite 7's disjoint Node ranges are checked correctly. Envinfo reports retain diagnosis without changing their fixed heading order.
- Markdown render-section selection is applied consistently without filtering collection or redacted JSON. Nonempty `$schema` metadata is accepted without fetching it.
- Requested Markdown backups work in stdout and JSON modes. Save failures remain observable without corrupting machine output, duplicating ordinary writes, uploading issues or showing sponsorship. Explicit save failures return 1; failed wrapped commands keep their child exit code.
- Builder validation is associated with its controls through an atomic polite status region and invalid states that clear on recovery. Real screen-reader testing was user-waived, not reported as passed.
- Collector deadlines are installed before synchronous setup. Windows version probes avoid synchronous PATH scans, and timed-out probes release inherited output pipes.

### Maintenance

- Installed package minimum is Node 20.5.0. Development tooling requires Node `^20.19.0 || >=22.12.0`; exact-minimum installed-artifact checks remain separate.
- Updated Vite to 7.3.6 and Vitest to 4.1.11, with a verified esbuild 0.28.1 override. No runtime dependency was added.
- Expanded Linux/Windows CI to Node 20, 22 and 24, plus exact-minimum Linux/Windows and macOS installed-artifact checks.

## 0.4.1 — 2026-10-01

### Added

- Optional hosted sponsorship links in the website's About section and footers.
- One optional stderr notice after a successful interactive CLI report save. It stays out of machine-output modes, redirected streams, CI, failed wrapped commands, issue creation, reports, clipboard contents, and library calls. No payment SDK, browser auto-open, or delay was added.

### Fixed

- HTML-only `no-transform` headers keep injected analytics and WebMCP scripts out of the deployed website while leaving JS and CSS compressible.
- The CI diagnostics demo tolerates only its deliberately failing step, asserts the expected outcome, and keeps real collection failures fatal.
- Package and lockfile release versions are synchronized at 0.4.1.

## 0.4.0

### Added

- **Version-Mismatch Heuristics (PMP-42)**: Analyzes installed packages and active runtimes against 26 well-known dependency compatibility rules, rendering a "Likely Cause" section at the top of reports when incompatibilities are detected (e.g. Next.js 15 with React 18, Node runtime versions with Vite 6/7, Tailwind CSS v4, etc.). Disable with `--no-heuristics`.
- **Offline Sourcemap Resolver (PMP-44)**: Rewrites minified stack traces in the Logs section into original source locations (`src/app/page.tsx:42:7 [from bundle.js:1:48213]`) using local source maps or inline data maps. Strictly offline with zero network fetching, path traversal guards, 200-frame budget ceiling, and mandatory re-redaction of resolved file paths. Disable with `--no-sourcemaps`.
- **Templates (`--template <name>`)**: Support for `default`, `minimal` (System, Runtimes, Logs), and `envinfo` (replicates `npx envinfo --system --binaries --npmPackages` headings and format for drop-in GitHub issue template compatibility).
- **Repo-Shipped Configuration**: `.crashpackrc.json` is discovered hierarchically by walking up from the current working directory to the git root. Added `template`, `issueTitlePrefix`, `sections`, `sourcemaps`, and `heuristics` configuration keys.
- **Maintainer Guide & GitHub Action**: Comprehensive maintainer documentation at `docs/for-maintainers.md` and the official composite action `poorvith-mp/crashpack-action@v1`.
- **Windows 11 Correctness**: Correct OS detection distinguishing Windows 11 (build >= 22000) from Windows 10, zero `wmic` usage, and fast `Get-NetTCPConnection` port collection with a 3s timeout.

### Closes

- Closes #21 (Version-mismatch heuristics).
- Closes #23 (Sourcemap resolver).

## 0.3.0

Source release; npm publication and the release tag are verified separately.

### Added

- JSON, TOML, and package.json CLI configuration with explicit precedence and per-field CLI overrides.
- Explicit `--clipboard` override alongside `--no-clipboard`.
- `--issue --create` for reviewed, confirmed GitHub creation through `gh`, retaining a local report for recovery.
- A static website, command builder, sample report, and installation, configuration, privacy, agent, and maintenance guide.

### Fixed

- Invalid configuration, line limits, and regex syntax fail before collection or wrapped command execution.
- Issue creation avoids uploads in stdin, machine-output, and noninteractive modes. Oversized reports stay intact for manual recovery.
- Report wording and docs describe heuristic redaction, environment values read in memory, and network boundaries without absolute privacy guarantees.

### Scope

The eight existing collectors remain the collection model. Dependency conflict diagnosis, source-map resolution, daemon restart, and memory dumps aren't part of this release. Existing issue discussions and git history remain the record for earlier work.
