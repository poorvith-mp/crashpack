# Changelog

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
