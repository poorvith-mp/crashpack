import { describe, it, expect } from 'vitest';
import { renderMarkdown } from './markdown.js';
import { CrashPack } from '../types.js';
import { redact } from '../redact/redact.js';

// Sections only accept SafeText, which only redact() can mint.
const safe = (value: string) => redact(value).text;

describe('Markdown Renderer', () => {
  it('renders a complete CrashPack into structured markdown matching specification', () => {
    const pack: CrashPack = {
      projectName: 'my-project',
      generatedAt: '2026-08-15 14:22 UTC',
      durationMs: 1200,
      redactionCount: 4,
      sections: [
        {
          id: 'logs',
          title: 'Logs',
          status: 'ok',
          content: safe('[last 200 lines, redacted]'),
          durationMs: 100,
        },
        {
          id: 'git',
          title: 'Git',
          status: 'ok',
          content: safe('- Branch: `main`\n- Remote: `github.com/user/repo`'),
          durationMs: 200,
        },
        {
          id: 'docker',
          title: 'Docker',
          status: 'unavailable',
          unavailableReason: safe('daemon not running'),
          durationMs: 50,
        },
        {
          id: 'env',
          title: 'Environment',
          status: 'unavailable',
          unavailableReason: safe('no .env file found'),
          durationMs: 10,
        },
      ],
    };

    const output = renderMarkdown(pack);

    // Header assertions
    expect(output).toContain('# crashpack · my-project');
    expect(output).toContain('_2026-08-15 14:22 UTC · collected in 1.2s · 4 values redacted_');

    // Section assertions
    // Logs are fenced so captured output cannot forge markdown structure (B-04)
    expect(output).toContain('## Logs\n\n```\n[last 200 lines, redacted]\n```');
    expect(output).toContain('## Git\n\n- Branch: `main`');
    expect(output).toContain('## Docker\n\n_Unavailable: daemon not running_');

    // Environment section omitted when unavailable
    expect(output).not.toContain('## Environment');

    // Footer assertion
    expect(output).toContain('Generated locally by crashpack · Built by Poorvith. Redaction can miss secrets; review before sharing.');
  });
});
