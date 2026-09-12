/**
 * Minimal semver parser and satisfies evaluator supporting ^, ~, >=, <=, >, <, =, exact, x, and ||.
 */

export function parseSemver(ver: string): [number, number, number] | null {
  const clean = ver.trim().replace(/^v/, '').replace(/^[=^~]/, '');
  const m = clean.match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
  if (!m) return null;
  return [
    parseInt(m[1], 10),
    m[2] !== undefined ? parseInt(m[2], 10) : 0,
    m[3] !== undefined ? parseInt(m[3], 10) : 0,
  ];
}

export function compareSemver(a: [number, number, number], b: [number, number, number]): number {
  if (a[0] !== b[0]) return a[0] - b[0];
  if (a[1] !== b[1]) return a[1] - b[1];
  return a[2] - b[2];
}

export function satisfiesSingle(ver: [number, number, number], comparator: string): boolean {
  const comp = comparator.trim();
  if (!comp || comp === '*' || comp === 'x') return true;

  // Wildcard 5.x or 18.x
  if (/^\d+\.x$/i.test(comp)) {
    const major = parseInt(comp.split('.')[0], 10);
    return ver[0] === major;
  }
  if (/^\d+\.\d+\.x$/i.test(comp)) {
    const parts = comp.split('.');
    return ver[0] === parseInt(parts[0], 10) && ver[1] === parseInt(parts[1], 10);
  }

  if (comp.startsWith('^')) {
    const target = parseSemver(comp.slice(1));
    if (!target) return false;
    if (compareSemver(ver, target) < 0) return false;
    if (target[0] > 0) return ver[0] === target[0];
    if (target[1] > 0) return ver[1] === target[1];
    return ver[2] === target[2];
  }

  if (comp.startsWith('~')) {
    const target = parseSemver(comp.slice(1));
    if (!target) return false;
    if (compareSemver(ver, target) < 0) return false;
    return ver[0] === target[0] && ver[1] === target[1];
  }

  if (comp.startsWith('>=')) {
    const target = parseSemver(comp.slice(2));
    return target ? compareSemver(ver, target) >= 0 : false;
  }
  if (comp.startsWith('>')) {
    const target = parseSemver(comp.slice(1));
    return target ? compareSemver(ver, target) > 0 : false;
  }
  if (comp.startsWith('<=')) {
    const target = parseSemver(comp.slice(2));
    return target ? compareSemver(ver, target) <= 0 : false;
  }
  if (comp.startsWith('<')) {
    const target = parseSemver(comp.slice(1));
    return target ? compareSemver(ver, target) < 0 : false;
  }
  if (comp.startsWith('=')) {
    const target = parseSemver(comp.slice(1));
    return target ? compareSemver(ver, target) === 0 : false;
  }

  // Bare number e.g. "15"
  if (/^\d+$/.test(comp)) {
    const major = parseInt(comp, 10);
    return ver[0] === major;
  }

  const target = parseSemver(comp);
  return target ? compareSemver(ver, target) === 0 : false;
}

export function satisfies(version: string, range: string): boolean {
  const ver = parseSemver(version);
  if (!ver) return false;

  // Split by OR (||)
  const orClauses = range.split('||').map((s) => s.trim()).filter(Boolean);
  if (orClauses.length === 0) return true;

  return orClauses.some((clause) => {
    // Split by AND (spaces)
    const andComparators = clause.split(/\s+/).filter(Boolean);
    return andComparators.every((comp) => satisfiesSingle(ver, comp));
  });
}
