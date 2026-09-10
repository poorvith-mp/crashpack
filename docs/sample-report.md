# crashpack · example-app

SYNTHETIC SAMPLE. Written to explain the format. No machine was inspected.
Redaction examples illustrate replacements; they do not prove a report is safe.

## Logs

```text
Error: connection refused at 127.0.0.1:5432
    at connect (src/database.ts:18:9)
DATABASE_PASSWORD=[redacted]
```

## Git

- Branch: `fix/database-retry`
- Remote: `https://github.com/example/example-app`
- Uncommitted changes: 1 file

```diff
- const retries = 0;
+ const retries = 3;
```

## Packages

| Package | Version |
| --- | --- |
| example-client | ^1.0.0 (declared; not installed) |

## Docker

_unavailable: Docker isn't available in this synthetic scenario_

## Environment

Keys: DATABASE_URL, DATABASE_PASSWORD. Values omitted by the env collector.

---
Review every section before sharing. Unknown secrets and identifying context can remain.
