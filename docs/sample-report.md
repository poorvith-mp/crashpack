# crashpack · example-app
_2026-09-12 06:00 UTC · collected in 0.4s · 3 values redacted_

SYNTHETIC SAMPLE. Written to explain the format. No machine was inspected.
Redaction examples illustrate replacements; they do not prove a report is safe.

## Likely Cause

- Next.js 15.0.3 requires React ^19; found 18.3.1.
  Fix: `npm install react@^19 react-dom@^19`

## Logs

```text
Error: invalid input
    at calculate (src/calculator.ts:3:11) [from dist/bundle.js:4:11]
    at main (src/calculator.ts:9:3) [from dist/bundle.js:9:3]
DATABASE_PASSWORD=[redacted]
```

## System

| Field | Value |
|---|---|
| OS | Windows 11 (build 22631) |
| Architecture | x64 |
| CPU | 8 cores |
| Memory | 16.0 GB total |

## Runtimes

- Node `22.13.4`
- npm `10.9.2`

## Git

- Branch: `feat/v0.4.0-release`
- Remote: `https://github.com/poorvith-mp/crashpack`
- Uncommitted changes: 1 file

```diff
- const retries = 0;
+ const retries = 3;
```

## Packages

| Package | Version |
|---|---|
| next | 15.0.3 |
| react | 18.3.1 |

## Environment

Keys: DATABASE_URL, DATABASE_PASSWORD. Values omitted by the env collector.

---
_Generated locally by crashpack · Built by Poorvith. Redaction can miss secrets; review before sharing._
