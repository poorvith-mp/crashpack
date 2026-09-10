import { expect, it } from 'vitest';
import { extractIssueUrl } from './cli.js';

it.each(['github.com', 'gitlab.com'])('accepts the normalized SSH remote emitted by collectGit for %s', host => {
  const normalized = `git@${host}:example/demo.git`.replace(/^git@([^:]+):/, '$1/').replace(/\.git$/, '');
  expect(extractIssueUrl(normalized)?.url).toContain(`https://${host}/example/demo/`);
  expect(extractIssueUrl(`attacker.example/${normalized}`)).toBeNull();
  expect(extractIssueUrl(`${host}.attacker.example/example/demo`)).toBeNull();
});
