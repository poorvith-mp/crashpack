import { it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../docs/index.html', import.meta.url), 'utf8');

it('provides an atomic polite builder status region', () => {
  const tag = html.match(/<p\b[^>]*\bid="builder-note"[^>]*>/)?.[0];
  expect(tag).toMatch(/role="status"/);
  expect(tag).toMatch(/aria-live="polite"/);
  expect(tag).toMatch(/aria-atomic="true"/);
});

it.each(['lines', 'wrapped-command', 'collectors'])('associates %s with builder feedback', id => {
  const tag = html.match(new RegExp(`<(?:input|fieldset)\\b[^>]*\\bid="${id}"[^>]*>`))?.[0];
  expect(tag).toBeDefined();
  expect(tag).toMatch(/aria-describedby="[^\"]*\bbuilder-note\b[^\"]*"/);
});
