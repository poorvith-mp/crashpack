import * as path from 'node:path';
import {
  Collector,
  CollectorContext,
  CrashPack,
  Section,
  SectionStatus,
} from './types.js';
import { redact } from './redact/redact.js';
import { collectLogs } from './collectors/logs.js';
import { collectGit } from './collectors/git.js';
import { collectSystem } from './collectors/system.js';
import { collectRuntimes } from './collectors/runtimes.js';
import { collectPackages } from './collectors/packages.js';
import { collectDocker } from './collectors/docker.js';
import { collectPorts } from './collectors/ports.js';
import { collectEnv } from './collectors/env.js';
import { renderMarkdown } from './render/markdown.js';
import { resolveSourcemapsInLog } from './sourcemap/resolve.js';
import { runHeuristics } from './heuristics/index.js';

export * from './types.js';
export * from './redact/redact.js';
export * from './render/markdown.js';
export * from './sourcemap/resolve.js';
export * from './heuristics/index.js';

export interface RunCollectorOptions {
  cwd?: string;
  timeoutMs?: number;
  lines?: number;
  since?: string;
  stdinLog?: string;
  wrapBuffer?: string;
  only?: string[];
  skip?: string[];
  redactExtra?: RegExp[];
  entropy?: boolean;
  sourcemaps?: boolean;
  heuristics?: boolean;
  /** Collection deadline; analysis uses its remaining budget. Default 5000ms. */
  deadlineMs?: number;
  /** Override the collector set. Used by tests to drive failure paths. */
  collectors?: { id: string; title: string; fn: Collector }[];
  onCollectorStart?: (id: string) => void;
  onCollectorComplete?: (id: string, status: SectionStatus, reason?: string) => void;
}

export const ALL_COLLECTORS: { id: string; title: string; fn: Collector }[] = [
  { id: 'logs', title: 'Logs', fn: collectLogs },
  { id: 'git', title: 'Git', fn: collectGit },
  { id: 'system', title: 'System', fn: collectSystem },
  { id: 'runtimes', title: 'Runtimes', fn: collectRuntimes },
  { id: 'packages', title: 'Packages', fn: collectPackages },
  { id: 'docker', title: 'Docker', fn: collectDocker },
  { id: 'ports', title: 'Ports', fn: collectPorts },
  { id: 'env', title: 'Environment', fn: collectEnv },
];

export async function createCrashPack(options: RunCollectorOptions = {}): Promise<CrashPack> {
  const startTime = Date.now();
  const cwd = options.cwd ? path.resolve(options.cwd) : process.cwd();
  const projectName = path.basename(cwd) || 'project';

  // Filter collectors
  let selected = options.collectors ?? ALL_COLLECTORS;
  if (options.only && options.only.length > 0) {
    const onlySet = new Set(options.only.map((s) => s.trim().toLowerCase()));
    selected = selected.filter((c) => onlySet.has(c.id.toLowerCase()));
  }
  if (options.skip && options.skip.length > 0) {
    const skipSet = new Set(options.skip.map((s) => s.trim().toLowerCase()));
    selected = selected.filter((c) => !skipSet.has(c.id.toLowerCase()));
  }

  const ctx: CollectorContext = {
    cwd,
    timeoutMs: options.timeoutMs ?? 2000,
    lines: options.lines ?? 200,
    since: options.since,
    stdinLog: options.stdinLog,
    wrapBuffer: options.wrapBuffer,
  };

  let totalRedactions = 0;
  let rawLogContent: string | undefined;
  const deadlineMs = options.deadlineMs ?? 5000;

  const collectorPromises = selected.map(async ({ id, title, fn }) => {
    const colStart = Date.now();
    // Install the deadline races before collectors can do synchronous setup.
    await Promise.resolve();
    options.onCollectorStart?.(id);

    try {
      const res = await fn(ctx);
      const colDuration = Date.now() - colStart;

      let section: Section;
      if (res.status === 'ok' && res.rawContent !== undefined) {
        // Retain raw logs locally for resolution, never in a public section.
        const analyzeLogs = id === 'logs' && options.sourcemaps !== false;
        if (analyzeLogs) rawLogContent = res.rawContent;
        const { text: safeContent, count } = redact(analyzeLogs ? '' : res.rawContent, options.redactExtra, { entropy: options.entropy });
        totalRedactions += count;

        section = {
          id,
          title,
          status: 'ok',
          content: safeContent,
          durationMs: colDuration,
          ...(res.data !== undefined ? { data: res.data } : {}),
        };
      } else {
        // MANDATORY: reasons carry raw command lines and paths, so they redact too
        const reason = redact(res.unavailableReason || 'unavailable', options.redactExtra, { entropy: options.entropy });
        totalRedactions += reason.count;

        section = {
          id,
          title,
          status: 'unavailable',
          unavailableReason: reason.text,
          durationMs: colDuration,
          ...(res.data !== undefined ? { data: res.data } : {}),
        };
      }

      options.onCollectorComplete?.(id, section.status, section.unavailableReason);
      return section;
    } catch (err: any) {
      const colDuration = Date.now() - colStart;
      // execa failure messages embed the full command line and cwd
      const reason = redact(err?.message || 'collector error', options.redactExtra, { entropy: options.entropy });
      totalRedactions += reason.count;

      const section: Section = {
        id,
        title,
        status: 'unavailable',
        unavailableReason: reason.text,
        durationMs: colDuration,
      };
      options.onCollectorComplete?.(id, 'unavailable', section.unavailableReason);
      return section;
    }
  });

  // Backstop: a pathological collector degrades to unavailable rather than
  // holding the whole run open (B-07). Preserves the rule that one collector
  // can never fail the pack.
  const sectionResults = await Promise.all(
    collectorPromises.map((promise, i) => {
      let timer: ReturnType<typeof setTimeout>;
      return Promise.race([
        promise,
        new Promise<Section>((resolve) => {
          timer = setTimeout(() => {
            const { id, title } = selected[i];
            resolve({
              id,
              title,
              status: 'unavailable',
              unavailableReason: redact('exceeded global deadline').text,
              durationMs: deadlineMs,
            });
          }, Math.max(0, deadlineMs - (Date.now() - startTime)));
          timer.unref?.();
        }),
      ]).finally(() => clearTimeout(timer));
    })
  );

  // Preserve canonical display order
  const orderMap = new Map(ALL_COLLECTORS.map((c, i) => [c.id, i]));
  sectionResults.sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0));

  // Post-process sourcemaps on logs section
  if (options.sourcemaps !== false) {
    const logsSection = sectionResults.find((s) => s.id === 'logs');
    if (logsSection && logsSection.status === 'ok' && rawLogContent !== undefined) {
      const remainingMs = Math.max(0, deadlineMs - (Date.now() - startTime));
      const resolved = await resolveSourcemapsInLog(rawLogContent, cwd, { budgetMs: Math.min(3000, remainingMs) });
      const { text: safeContent, count } = redact(resolved.text, options.redactExtra, { entropy: options.entropy });
      totalRedactions += count;
      logsSection.content = safeContent;
    }
  }

  // Version-mismatch heuristics producing Likely Cause section
  if (options.heuristics !== false) {
    const runtimesSec = sectionResults.find((s) => s.id === 'runtimes');
    const packagesSec = sectionResults.find((s) => s.id === 'packages');
    const findings = runHeuristics({
      packagesData: packagesSec?.data as Array<{ name: string; version: string }> | undefined,
      runtimesData: runtimesSec?.data as Record<string, string> | undefined,
      runtimesStatus: runtimesSec?.status,
    });

    if (findings.length > 0) {
      const lines = findings.map((f) => {
        let line = `- ${f.message}`;
        if (f.fix) line += `\n  Fix: \`${f.fix}\``;
        return line;
      });
      const { text: safeContent, count } = redact(lines.join('\n'), options.redactExtra, { entropy: options.entropy });
      totalRedactions += count;

      const likelyCauseSection: Section = {
        id: 'likely-cause',
        title: 'Likely Cause',
        status: 'ok',
        content: safeContent,
        durationMs: 0,
      };
      sectionResults.unshift(likelyCauseSection);
    }
  }

  // Invariant: Section.data is never present in rendered markdown or --json output
  for (const s of sectionResults) {
    delete s.data;
  }

  const totalDuration = Date.now() - startTime;
  const now = new Date();
  const formattedDate = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')} ${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')} UTC`;

  return {
    projectName,
    sections: sectionResults,
    generatedAt: formattedDate,
    durationMs: totalDuration,
    redactionCount: totalRedactions,
  };
}
