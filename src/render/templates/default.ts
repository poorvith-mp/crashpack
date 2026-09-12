import { CrashPack } from '../../types.js';
import { fenceFor } from '../fence.js';

export function renderDefault(pack: CrashPack): string {
  const durationSec = (pack.durationMs / 1000).toFixed(1);
  const redactionLabel = `${pack.redactionCount} value${pack.redactionCount === 1 ? '' : 's'} redacted`;
  const header = `# crashpack · ${pack.projectName}\n_${pack.generatedAt} · collected in ${durationSec}s · ${redactionLabel}_\n`;

  const sectionBlocks: string[] = [];

  for (const section of pack.sections) {
    if (section.id === 'env' && section.status === 'unavailable') {
      continue;
    }

    if (section.id === 'logs' && section.status === 'unavailable') {
      continue;
    }

    if (section.status === 'ok' && section.content) {
      if (section.id === 'logs') {
        const fence = fenceFor(section.content);
        sectionBlocks.push(`## ${section.title}\n\n${fence}\n${section.content}\n${fence}`);
      } else {
        sectionBlocks.push(`## ${section.title}\n\n${section.content}`);
      }
    } else if (section.status === 'unavailable') {
      const reason = section.unavailableReason || 'not available';
      sectionBlocks.push(`## ${section.title}\n\n_Unavailable: ${reason}_`);
    }
  }

  const footer = `\n---\n_Generated locally by crashpack · Built by Poorvith. Redaction can miss secrets; review before sharing._\n`;

  return [header, ...sectionBlocks].join('\n\n') + footer;
}
