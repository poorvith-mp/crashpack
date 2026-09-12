import peersData from './peers.json' with { type: 'json' };
import { satisfies } from './semver.js';

export interface Finding {
  severity: 'likely' | 'possible';
  message: string;
  source: string;
  fix?: string;
}

export interface HeuristicContext {
  packagesData?: Array<{ name: string; version: string }>;
  runtimesData?: Record<string, string>;
  runtimesStatus?: 'ok' | 'unavailable';
}

interface PeerRule {
  pkg: string;
  range: string;
  requires: {
    pkg: string;
    range: string;
  };
  severity?: 'likely' | 'possible';
  message?: string;
  fix?: string;
  source: string;
}

function formatName(name: string): string {
  const lower = name.toLowerCase();
  if (lower === 'next') return 'Next.js';
  if (lower === 'react') return 'React';
  if (lower === 'node') return 'Node.js';
  if (lower === 'vite') return 'Vite';
  if (lower === 'typescript') return 'TypeScript';
  return name;
}

export function runHeuristics(ctx: HeuristicContext): Finding[] {
  const findings: Finding[] = [];
  const rules = peersData as PeerRule[];

  const packages = ctx.packagesData || [];
  const packageMap = new Map<string, string>();
  for (const p of packages) {
    packageMap.set(p.name.toLowerCase(), p.version);
  }

  for (const rule of rules) {
    const pkgName = rule.pkg.toLowerCase();
    const installedVer = packageMap.get(pkgName);
    if (!installedVer) continue;

    const cleanVer = installedVer.replace(/^[=^~v]/, '').trim();
    if (!satisfies(cleanVer, rule.range)) continue;

    const reqPkgName = rule.requires.pkg.toLowerCase();

    // Check 1: Requires Node runtime
    if (reqPkgName === 'node') {
      if (ctx.runtimesStatus !== 'ok' || !ctx.runtimesData?.Node) {
        continue;
      }
      const nodeVer = ctx.runtimesData.Node.replace(/^[=^~v]/, '').trim();
      if (!satisfies(nodeVer, rule.requires.range)) {
        const msg = `${formatName(rule.pkg)} ${installedVer} requires ${formatName(rule.requires.pkg)} ${rule.requires.range}; found ${nodeVer}.`;
        findings.push({
          severity: rule.severity || 'possible',
          message: msg,
          source: rule.source,
          ...(rule.fix ? { fix: rule.fix } : {}),
        });
      }
      continue;
    }

    // Check 2: Requires another package
    const foundReqVer = packageMap.get(reqPkgName);
    if (foundReqVer) {
      const cleanReqVer = foundReqVer.replace(/^[=^~v]/, '').trim();
      if (!satisfies(cleanReqVer, rule.requires.range)) {
        const msg = `${formatName(rule.pkg)} ${installedVer} requires ${formatName(rule.requires.pkg)} ${rule.requires.range}; found ${foundReqVer}.`;
        findings.push({
          severity: rule.severity || 'likely',
          message: msg,
          source: rule.source,
          ...(rule.fix ? { fix: rule.fix } : {}),
        });
      }
    }
  }

  return findings;
}
