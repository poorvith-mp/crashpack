import * as fs from 'node:fs';
import * as path from 'node:path';
import { decodeVlq } from './vlq.js';

export interface SourcemapResolutionResult {
  text: string;
  resolvedCount: number;
  notes: string[];
}

interface Segment {
  genCol: number;
  srcIdx: number;
  origLine: number;
  origCol: number;
  nameIdx?: number;
}

interface ParsedMap {
  sources: string[];
  sourceRoot?: string;
  dir: string;
  lineMappings: Segment[][];
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MiB
const FRAME_REGEX = /(\(?)(file:\/\/\/?|(?:[A-Za-z]:)?[^\s():]+\.(?:m?js|cjs))\:(\d+)\:(\d+)(\)?)/g;

export async function resolveSourcemapsInLog(
  log: string,
  cwd: string,
  options?: { maxFrames?: number; maxMaps?: number; budgetMs?: number }
): Promise<SourcemapResolutionResult> {
  const maxFrames = options?.maxFrames ?? 200;
  const maxMaps = options?.maxMaps ?? 20;
  const budgetMs = options?.budgetMs ?? 3000;

  const startTime = Date.now();
  let resolvedCount = 0;
  let distinctMapsCount = 0;
  let budgetExhausted = false;
  const notes: string[] = [];

  const mapCache = new Map<string, ParsedMap | 'indexed' | 'skip'>();

  function addNote(note: string) {
    if (!notes.includes(note)) {
      notes.push(note);
    }
  }

  function getOrLoadMap(bundlePathRaw: string): ParsedMap | 'indexed' | 'skip' {
    if (budgetExhausted) return 'skip';
    if (Date.now() - startTime > budgetMs) {
      budgetExhausted = true;
      addNote('(sourcemap resolution stopped: budget)');
      return 'skip';
    }

    let filePath = bundlePathRaw;
    if (filePath.startsWith('file://')) {
      filePath = filePath.replace(/^file:\/\/\/?/, '');
      if (process.platform === 'win32' && /^[a-zA-Z]:/.test(filePath)) {
        // Windows drive letter
      } else if (process.platform !== 'win32') {
        filePath = '/' + filePath;
      }
    }

    const absPath = path.resolve(cwd, filePath);
    const resolvedCwd = path.resolve(cwd);

    // Traversal check: bundle must be within cwd
    const relToCwd = path.relative(resolvedCwd, absPath);
    if (relToCwd.startsWith('..') || path.isAbsolute(relToCwd)) {
      return 'skip';
    }

    if (mapCache.has(absPath)) {
      return mapCache.get(absPath)!;
    }

    if (distinctMapsCount >= maxMaps) {
      budgetExhausted = true;
      addNote('(sourcemap resolution stopped: budget)');
      return 'skip';
    }

    try {
      if (!fs.existsSync(absPath)) {
        mapCache.set(absPath, 'skip');
        return 'skip';
      }
      const stat = fs.statSync(absPath);
      if (stat.size > MAX_FILE_SIZE) {
        mapCache.set(absPath, 'skip');
        return 'skip';
      }

      // Check 1: adjacent .map file
      const adjacentMap = absPath + '.map';
      let mapJsonStr: string | null = null;
      let mapDir = path.dirname(absPath);

      if (fs.existsSync(adjacentMap)) {
        const mapStat = fs.statSync(adjacentMap);
        if (mapStat.size <= MAX_FILE_SIZE) {
          mapJsonStr = fs.readFileSync(adjacentMap, 'utf8');
          mapDir = path.dirname(adjacentMap);
        }
      }

      // Check 2: sourceMappingURL in the last 4 KiB
      if (!mapJsonStr) {
        const readSize = Math.min(stat.size, 4096);
        const fd = fs.openSync(absPath, 'r');
        const buffer = Buffer.alloc(readSize);
        fs.readSync(fd, buffer, 0, readSize, stat.size - readSize);
        fs.closeSync(fd);

        const tail = buffer.toString('utf8');
        const match = tail.match(/[#@]\s*sourceMappingURL=(\S+)/);
        if (match) {
          const mapUrl = match[1].trim();
          if (mapUrl.startsWith('data:application/json')) {
            const b64Index = mapUrl.indexOf('base64,');
            if (b64Index !== -1) {
              const b64 = mapUrl.slice(b64Index + 7);
              mapJsonStr = Buffer.from(b64, 'base64').toString('utf8');
            }
          } else if (mapUrl.startsWith('http://') || mapUrl.startsWith('https://')) {
            // Offline guarantee: NEVER fetch external URLs
            mapCache.set(absPath, 'skip');
            return 'skip';
          } else {
            // Relative file path
            const candidate = path.resolve(path.dirname(absPath), mapUrl);
            const relMap = path.relative(resolvedCwd, candidate);
            if (relMap.startsWith('..') || path.isAbsolute(relMap)) {
              // Path traversal guard
              mapCache.set(absPath, 'skip');
              return 'skip';
            }
            if (fs.existsSync(candidate)) {
              const cStat = fs.statSync(candidate);
              if (cStat.size <= MAX_FILE_SIZE) {
                mapJsonStr = fs.readFileSync(candidate, 'utf8');
                mapDir = path.dirname(candidate);
              }
            }
          }
        }
      }

      if (!mapJsonStr) {
        mapCache.set(absPath, 'skip');
        return 'skip';
      }

      distinctMapsCount++;
      const rawMap = JSON.parse(mapJsonStr);

      // Indexed source maps with 'sections' are not supported in minimal resolver
      if (rawMap.sections) {
        addNote('(sourcemap: indexed source maps not supported)');
        mapCache.set(absPath, 'indexed');
        return 'indexed';
      }

      if (!rawMap.mappings || !Array.isArray(rawMap.sources)) {
        mapCache.set(absPath, 'skip');
        return 'skip';
      }

      // Parse mappings
      const lineStrings = rawMap.mappings.split(';');
      const lineMappings: Segment[][] = [];
      let srcIdx = 0;
      let origLine = 0;
      let origCol = 0;
      let nameIdx = 0;

      for (let l = 0; l < lineStrings.length; l++) {
        const lineStr = lineStrings[l];
        const segs: Segment[] = [];
        if (lineStr) {
          let genCol = 0;
          const segStrs = lineStr.split(',');
          for (const segStr of segStrs) {
            if (!segStr) continue;
            const nums = decodeVlq(segStr);
            if (nums.length === 0) continue;
            genCol += nums[0];
            if (nums.length >= 4) {
              srcIdx += nums[1];
              origLine += nums[2];
              origCol += nums[3];
              let nIdx: number | undefined;
              if (nums.length >= 5) {
                nameIdx += nums[4];
                nIdx = nameIdx;
              }
              segs.push({ genCol, srcIdx, origLine, origCol, nameIdx: nIdx });
            }
          }
        }
        lineMappings.push(segs);
      }

      const parsed: ParsedMap = {
        sources: rawMap.sources,
        sourceRoot: rawMap.sourceRoot,
        dir: mapDir,
        lineMappings,
      };

      mapCache.set(absPath, parsed);
      return parsed;
    } catch {
      mapCache.set(absPath, 'skip');
      return 'skip';
    }
  }

  function resolvePosition(
    parsed: ParsedMap,
    genLine: number,
    genCol: number
  ): { sourceFile: string; line: number; col: number } | null {
    const lineIndex = genLine - 1;
    if (lineIndex < 0 || lineIndex >= parsed.lineMappings.length) return null;
    const segs = parsed.lineMappings[lineIndex];
    if (!segs || segs.length === 0) return null;

    const targetCol = genCol - 1;
    let bestSeg: Segment | null = null;
    for (const seg of segs) {
      if (seg.genCol <= targetCol) {
        bestSeg = seg;
      } else {
        break;
      }
    }

    if (!bestSeg) return null;
    let sourcePath = parsed.sources[bestSeg.srcIdx];
    if (!sourcePath) return null;

    if (parsed.sourceRoot) {
      sourcePath = path.join(parsed.sourceRoot, sourcePath);
    }

    const absSource = path.resolve(parsed.dir, sourcePath);
    const relToCwd = path.relative(cwd, absSource);
    const isInsideCwd = !relToCwd.startsWith('..') && !path.isAbsolute(relToCwd);
    const sourceDisplay = isInsideCwd ? relToCwd.replace(/\\/g, '/') : sourcePath;

    return {
      sourceFile: sourceDisplay,
      line: bestSeg.origLine + 1,
      col: bestSeg.origCol + 1,
    };
  }

  const newLines = log.split(/\r?\n/).map((line) => {
    return line.replace(FRAME_REGEX, (match, openParen, file, lineStr, colStr, closeParen) => {
      if (resolvedCount >= maxFrames) {
        if (!budgetExhausted) {
          budgetExhausted = true;
          addNote('(sourcemap resolution stopped: budget)');
        }
        return match;
      }

      if (Date.now() - startTime > budgetMs) {
        if (!budgetExhausted) {
          budgetExhausted = true;
          addNote('(sourcemap resolution stopped: budget)');
        }
        return match;
      }

      const mapResult = getOrLoadMap(file);
      if (mapResult === 'skip' || mapResult === 'indexed') {
        return match;
      }

      const genLine = parseInt(lineStr, 10);
      const genCol = parseInt(colStr, 10);
      const orig = resolvePosition(mapResult, genLine, genCol);
      if (!orig) return match;

      resolvedCount++;
      const origLoc = `${orig.sourceFile}:${orig.line}:${orig.col}`;
      const bundleLoc = `${file}:${lineStr}:${colStr}`;

      if (openParen && closeParen) {
        return `(${origLoc}) [from ${bundleLoc}]`;
      }
      return `${origLoc} [from ${bundleLoc}]`;
    });
  });

  let outputText = newLines.join('\n');
  if (notes.length > 0) {
    outputText = outputText.trimEnd() + '\n' + notes.join('\n') + '\n';
  }

  return {
    text: outputText,
    resolvedCount,
    notes,
  };
}
