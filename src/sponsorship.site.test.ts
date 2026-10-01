import { expect, it } from 'vitest';
import * as fs from 'node:fs';

const sponsorUrl = 'https://razorpay.me/@poorvithmp';

it.each(['index.html', 'guide.html', 'for-maintainers.html'])('offers voluntary sponsorship from the %s footer', (page) => {
  const html = fs.readFileSync(`docs/${page}`, 'utf8');
  const footer = html.match(/<footer\b[^>]*>([\s\S]*?)<\/footer>/)?.[1] || '';
  const sponsor = [...footer.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)]
    .find((match) => match[1].includes(`href="${sponsorUrl}"`));
  expect(sponsor, 'A footer link should open the hosted sponsorship page').toBeDefined();
  expect(sponsor![2]).toContain('Sponsor my work');
  expect(sponsor![1]).toContain('target="_blank"');
  expect(sponsor![1]).toContain('rel="noopener noreferrer"');
});

it('offers sponsorship beside the author information without a payment script', () => {
  const html = fs.readFileSync('docs/index.html', 'utf8');
  const about = html.match(/<section id="about"[^>]*>([\s\S]*?)<\/section>/)?.[1] || '';
  expect(about).toContain(`href="${sponsorUrl}"`);
  expect(about).toContain('Sponsorship is optional');
  expect(html).not.toMatch(/<(?:script|iframe)\b[^>]*(?:src|href)="https:\/\/(?:[^"/]+\.)?razorpay\./i);
});
