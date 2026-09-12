import { CrashPack } from '../types.js';
import { renderDefault } from './templates/default.js';
import { renderMinimal } from './templates/minimal.js';
import { renderEnvinfo } from './templates/envinfo.js';

export function renderReport(pack: CrashPack, template = 'default'): string {
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
