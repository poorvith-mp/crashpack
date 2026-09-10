# Changelog

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
