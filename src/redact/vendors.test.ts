import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { redact } from './redact.js';

/**
 * Nothing here is a real credential — but secret scanners match on shape, not
 * provenance, so a literal fixture trips both the local pre-commit hook and
 * GitHub push protection. Every token is assembled at runtime from a prefix
 * and a body, the same convention redact.test.ts uses, so no credential-shaped
 * string is ever committed.
 */
const token = (prefix: string, body: string) => prefix + body;

const OPENAI_PROJECT = token('sk-', 'proj-abc123DEF456ghi789JKL012mno345PQR678stu');
const OPENAI_LEGACY = token('sk-', 'AbCdEf1234567890AbCdEf1234567890AbCdEf12');
const ANTHROPIC = token('sk-ant-', 'api03-AbCdEf1234567890xyzAbCdEf1234');
const GOOGLE = token('AIza', 'SyA1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q7R');
const SENDGRID = token('SG.', 'aBcDeFgHiJkLmNoPqRsT.uVwXyZ0123456789abcdefghijklmnop');
const SLACK_HOOK = token('https://hooks.slack.com/services/', 'T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX');
const HUGGINGFACE = token('hf_', 'QWERTYuiopASDFGHjklZXCVBNMqwerty12');
const GITLAB_PAT = token('glpat-', 'AbCdEf1234567890XyZw');
const TELEGRAM = token('123456789:', 'AAEhBOweik6ad6PsVwZjZjZjZjZjZjZjZjA');
const TWILIO = token('SK', '0123456789abcdef0123456789abcdef');
const DOPPLER = token('dp.pt.', 'abcdefghij0123456789abcdefghij0123456789abcd');
const LINEAR = token('lin_api_', 'abcdefghij0123456789abcdefghij0123456789abcd');
const NPM_TOKEN = token('npm_', 'abcdefghij0123456789abcdefghij0123456789abcd');

/**
 * B-02: every case here passes through UNTOUCHED on v0.1.2.
 * If one goes green before its pattern lands, the test is wrong.
 */
const LEAKS: [name: string, input: string, secret: string][] = [
  ['openai project', `calling api ${OPENAI_PROJECT} failed`, OPENAI_PROJECT],
  ['openai legacy', `key ${OPENAI_LEGACY} rejected`, OPENAI_LEGACY],
  ['anthropic', `auth failed ${ANTHROPIC}`, ANTHROPIC],
  ['google api', `req to ${GOOGLE} denied`, GOOGLE],
  ['sendgrid', `${SENDGRID} bounced`, SENDGRID],
  ['slack webhook', `post ${SLACK_HOOK} 500`, SLACK_HOOK],
  ['huggingface', `${HUGGINGFACE} unauthorized`, HUGGINGFACE],
  ['gitlab pat', `clone failed ${GITLAB_PAT}`, GITLAB_PAT],
  ['telegram bot', `bot ${TELEGRAM} timeout`, TELEGRAM],
  ['twilio', `sid ${TWILIO} invalid`, TWILIO],
  ['doppler', `${DOPPLER} expired`, DOPPLER],
  ['linear', `${LINEAR} 401`, LINEAR],
  ['npm long token', `${NPM_TOKEN} publish failed`, NPM_TOKEN],
];

describe('Vendor token coverage (B-02)', () => {
  for (const [name, input, secret] of LEAKS) {
    it(`redacts ${name}`, () => {
      const out = redact(input).text;
      expect(out).not.toContain(secret);
      expect(out).toContain('[redacted]');
    });
  }

  it('redacts a basic-auth password but keeps the username', () => {
    const out = redact('cloning https://admin:hunter2@internal.example.com/api').text;
    expect(out).not.toContain('hunter2');
    expect(out).toContain('admin');
  });
});

describe('Unquoted value truncation (B-03)', () => {
  it('redacts the whole unquoted value including spaces', () => {
    const out = redact('DB_PASSWORD=my secret pass phrase').text;
    expect(out).not.toContain('secret pass phrase');
  });
});

describe('No-redact corpus (D-2 safety net)', () => {
  const corpus = fs.readFileSync(
    path.join(process.cwd(), 'fixtures', 'no-redact-corpus.txt'),
    'utf8'
  );

  it('leaves benign high-entropy strings untouched while masking the home prefix', () => {
    const res = redact(corpus);
    expect(res.text).toBe(corpus.replace('/home/user/', '~/'));
    expect(res.count).toBe(1);
  });
});
