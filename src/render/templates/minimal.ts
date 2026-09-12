import { CrashPack } from '../../types.js';
import { renderDefault } from './default.js';

const MINIMAL_SECTIONS = new Set(['system', 'runtimes', 'logs']);

export function renderMinimal(pack: CrashPack): string {
  const filteredPack: CrashPack = {
    ...pack,
    sections: pack.sections.filter((s) => MINIMAL_SECTIONS.has(s.id)),
  };
  return renderDefault(filteredPack);
}
