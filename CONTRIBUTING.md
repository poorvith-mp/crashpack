# Contributing to Crashpack

Start with a concrete failure, a small reproduction, and the behavior you expect. Search existing issues first. Keep examples synthetic: logs and diffs can contain credentials or private code. Report security problems through [private vulnerability reporting](https://github.com/poorvith-mp/crashpack/security/advisories/new).

## Local setup

Use Node.js 20 or newer and Git.

```sh
git clone https://github.com/poorvith-mp/crashpack.git
cd crashpack
npm ci
npm run typecheck
npm test
npm run build
node dist/cli.js --help
```

Use `npm run test:watch` for focused iteration and `npm run dev` to rebuild bundles while editing. Test collection in a fixture or directory whose contents you intend to inspect. Use `--no-clipboard` for manual checks.

## Code boundaries

- `src/collectors/` extracts context and returns `RawText`; collectors don't write reports, copy to the clipboard, or upload content.
- `src/index.ts` selects and runs collectors, redacts content and failure reasons, and returns a `CrashPack`. Unavailable collectors shouldn't fail the entire pack.
- `src/redact/` implements heuristic matching. `SafeText` marks passage through the pipeline; it isn't proof that every secret was removed.
- `src/render/` produces Markdown. Preserve arbitrary code fences and require review before sharing.
- `src/config.ts` loads and validates CLI configuration. The library doesn't automatically load it.
- `src/cli.ts` owns shell wrapping, stdin, output, clipboard, URL generation, and explicitly confirmed GitHub uploads.

Environment files are read in memory to extract keys; never add their values to the environment section. Keep ordinary collection free of telemetry and report uploads. Preserve loopback-only port probing and document Docker's possible remote daemon. External collector commands use a 2-second default timeout; the best-effort asynchronous collection deadline defaults to 5 seconds. Synchronous work, event-loop scheduling, and child cleanup can exceed it. These controls don't bound a wrapped command, interactive prompt, or CPU-bound regex execution.

## Checks before a pull request

Add a focused regression test when behavior changes. Use synthetic credentials and mock upload paths; don't create real issues or contact production services from tests. Tests cover their fixtures, not a universal privacy guarantee.

```sh
npm run typecheck
npm test
npm run build
npm run build:site
```

For site changes, run `npm run dev:site` and inspect `/` and `/guide` at narrow and wide widths. Check keyboard navigation, skip links, copy feedback, reduced motion, anchors, and tables. The site uses plain HTML/CSS and a bundled local script. Avoid remote fonts, images, and scripts.

Only generated `site-dist` belongs in the Cloudflare upload. Keep reports, fixtures, private logs, source, and package artifacts out. `wrangler.jsonc` configures the static-assets Worker and custom domain. After authorized deployment, `npm run deploy:site` invokes the pinned Wrangler CLI. See [maintenance](https://crashpack.poorvithmp.com/guide#maintenance).

Open a focused PR describing the trigger, resulting behavior, checks, and remaining limits. Keep commit messages mechanical, for example `fix: validate configured log line limits`. Use existing tools or the standard library before adding dependencies.

Heuristics [#21](https://github.com/poorvith-mp/crashpack/issues/21), source maps [#23](https://github.com/poorvith-mp/crashpack/issues/23), and daemon memory [#24](https://github.com/poorvith-mp/crashpack/issues/24) need their own designs. Preserve those discussions; wrapping doesn't imply daemon restart or signal-management support.
