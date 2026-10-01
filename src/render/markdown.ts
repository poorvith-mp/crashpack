import { CrashPack } from '../types.js';
import { renderDefault } from './templates/default.js';
import { renderMinimal } from './templates/minimal.js';
import { renderEnvinfo } from './templates/envinfo.js';
import { KNOWN_SECTIONS } from '../config.js';

export function renderReport(pack: CrashPack, template = 'default', sections?: string[]): string {
  if (sections !== undefined) {
    const ids = [...new Set(sections.map((id) => id.trim().toLowerCase()))];
    if (ids.some((id) => !KNOWN_SECTIONS.has(id))) {
      process.stderr.write('warning: unknown render section ID ignored\n');
    }
    pack = { ...pack, sections: ids.flatMap((id) => KNOWN_SECTIONS.has(id) ? pack.sections.filter((s) => s.id === id) : []) };
  }
  switch (template) {
    case 'default':
      return renderDefault(pack);
    case 'minimal':
      return renderMinimal(pack);
    case 'envinfo':
      return renderEnvinfo(pack);
    default: {
      const err = new Error(`Unknown template "${template}". Available: default, envinfo, minimal.`);
      (err as any).exitCode = 2;
      throw err;
    }
  }
}

export function renderMarkdown(pack: CrashPack): string {
  return renderReport(pack, 'default');
}
