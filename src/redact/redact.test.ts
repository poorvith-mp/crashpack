import { describe, it, expect } from 'vitest';
import { redact } from './redact.js';
import { asRawText } from '../types.js';

describe('home-path privacy', () => {
  it.each([
    ['/home/synthetic-user/project/bundle.js:1:1', '~/project/bundle.js:1:1'],
    ['/Users/synthetic-user/project/bundle.js:1:1', '~/project/bundle.js:1:1'],
    ['/home/合成-user/project/bundle.js:1:1', '~/project/bundle.js:1:1'],
    ['/root/project/bundle.js:1:1', '~/project/bundle.js:1:1'],
    ['C:/Users/synthetic-user/project/bundle.js:1:1', '~/project/bundle.js:1:1'],
  ])('masks the home prefix but preserves the source location in %s', (input, expected) => {
    const result = redact(asRawText(`at main (${input})`), undefined, { entropy: false });
    expect(result.text).toBe(`at main (${expected})`);
    expect(result.count).toBe(1);
    expect(redact(result.text, undefined, { entropy: false }).count).toBe(0);
  });

  it('does not rewrite relative source names or non-home absolute paths', () => {
    const input = 'src/home/example.ts:1:1 /opt/project/main.ts:2:3 /rooted/main.ts:4:5 https://example.test/home/sample';
    expect(redact(input, undefined, { entropy: false }).text).toBe(input);
  });
});

describe('Redaction Core (TDD & Adversarial Corpus)', () => {
  describe('Standard secret pattern detection', () => {
    it('redacts AWS access keys', () => {
      const key = 'AK' + 'IAIOSFODNN7EXAMPLE';
      const raw = asRawText(`Found AWS key ${key} and secret in config`);
      const { text, count } = redact(raw);
      expect(text).not.toContain(key);
      expect(text).toContain('[redacted]');
      expect(count).toBe(1);
    });

    it('redacts Stripe secret and publishable keys', () => {
      const skLive = 'sk_' + 'live_' + '51NzABC1234567890abcdef';
      const pkLive = 'pk_' + 'live_' + '51NzABC1234567890abcdef';
      const skTest = 'sk_' + 'test_' + '51Nz12345';

      const raw = asRawText(`Stripe keys: ${skLive} and ${pkLive} and ${skTest}`);
      const { text, count } = redact(raw);
      expect(text).not.toContain(skLive);
      expect(text).not.toContain(pkLive);
      expect(text).not.toContain(skTest);
      expect(count).toBe(3);
    });

    it('redacts GitHub personal access tokens and OAuth tokens', () => {
      const ghp = 'gh' + 'p_1234567890abcdef1234567890abcdef123456';
      const gho = 'gh' + 'o_abc123';
      const pat = 'git' + 'hub_pat_11ABCD_1234567890';

      const raw = asRawText(`GH tokens: ${ghp} and ${gho} and ${pat}`);
      const { text, count } = redact(raw);
      expect(text).not.toContain(ghp);
      expect(text).not.toContain(gho);
      expect(text).not.toContain(pat);
      expect(count).toBeGreaterThanOrEqual(3);
    });

    it('redacts multi-line private key blocks', () => {
      const raw = asRawText(`
-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEA0Y1+example+private+key+material+here
more+lines+of+base64+encoded+secret+content+abcdef123456
-----END RSA PRIVATE KEY-----
`);
      const { text, count } = redact(raw);
      expect(text).not.toContain('MIIEowIBAAKCAQEA0Y1+example+private+key+material+here');
      expect(text).not.toContain('more+lines+of+base64+encoded+secret+content+abcdef123456');
      expect(text).toContain('[redacted private key]');
      expect(count).toBe(1);
    });

    it('redacts OPENSSH and EC private keys', () => {
      const raw = asRawText(`
-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAABlwAAAAdzc2gtcn
-----END OPENSSH PRIVATE KEY-----
`);
      const { text, count } = redact(raw);
      expect(text).not.toContain('b3BlbnNzaC1rZXktdjE');
      expect(text).toContain('[redacted private key]');
      expect(count).toBe(1);
    });

    it('redacts JSON Web Tokens (JWT)', () => {
      const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
      const raw = asRawText(`Authorization: Bearer ${jwt}`);
      const { text, count } = redact(raw);
      expect(text).not.toContain(jwt);
      expect(count).toBeGreaterThanOrEqual(1);
    });

    it('redacts connection strings with credentials', () => {
      const raw = asRawText(`
Database URLs:
postgres://app_user:superSecretPass123!@db.internal.example.com:5432/production_db
mongodb+srv://admin:clusterPassword99@cluster0.abcde.mongodb.net/test?retryWrites=true
mysql://root:p%40ssw0rd@127.0.0.1:3306/mydb
redis://:mypassword@redis.cache.windows.net:6379/0
`);
      const { text } = redact(raw);
      expect(text).not.toContain('superSecretPass123!');
      expect(text).not.toContain('clusterPassword99');
      expect(text).not.toContain('p%40ssw0rd');
      expect(text).not.toContain('mypassword');
      expect(text).toContain('postgres://app_user:[redacted]@db.internal.example.com:5432/production_db');
      expect(text).toContain('mongodb+srv://admin:[redacted]@cluster0.abcde.mongodb.net/test?retryWrites=true');
      expect(text).toContain('mysql://root:[redacted]@127.0.0.1:3306/mydb');
    });

    it('redacts sensitive KEY=value and KEY: value assignments while keeping key visible', () => {
      const sk = 'sk_' + 'live_' + '1234567890abcdef';
      const gh = 'gh' + 'p_abcdef1234567890abcdef1234567890abcdef';
      const raw = asRawText(`
STRIPE_SECRET_KEY=${sk}
DATABASE_PASSWORD="super-secret-password-val"
AWS_SECRET_ACCESS_KEY='wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY'
AUTH_TOKEN: mySecretAuthToken999
API_SECRET = secret_api_key_value
GITHUB_TOKEN=${gh}
PRIVATE_KEY_ID=key_123456789
`);
      const { text } = redact(raw);
      expect(text).toContain('STRIPE_SECRET_KEY=[redacted]');
      expect(text).toContain('DATABASE_PASSWORD=[redacted]');
      expect(text).toContain('AWS_SECRET_ACCESS_KEY=[redacted]');
      expect(text).toContain('AUTH_TOKEN: [redacted]');
      expect(text).toContain('API_SECRET = [redacted]');
      expect(text).toContain('GITHUB_TOKEN=[redacted]');
      expect(text).not.toContain('super-secret-password-val');
      expect(text).not.toContain('wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY');
      expect(text).not.toContain('mySecretAuthToken999');
    });

    it('preserves non-sensitive environment variables', () => {
      const raw = asRawText(`
NODE_ENV=production
PORT=3000
HOST=localhost
DEBUG=express:*
LOG_LEVEL=info
`);
      const { text, count } = redact(raw);
      expect(text).toContain('NODE_ENV=production');
      expect(text).toContain('PORT=3000');
      expect(text).toContain('HOST=localhost');
      expect(text).toContain('DEBUG=express:*');
      expect(count).toBe(0);
    });

    it('redacts Bearer tokens in Authorization headers', () => {
      const raw = asRawText('Header "Authorization: Bearer mySecretToken1234567890"');
      const { text, count } = redact(raw);
      expect(text).not.toContain('mySecretToken1234567890');
      expect(text).toContain('Authorization: Bearer [redacted]');
      expect(count).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Adversarial & nested contexts', () => {
    it('redacts secrets embedded in git diffs', () => {
      const sk = 'sk_' + 'live_' + '51ABCDE9876543210zyxwvutsrq';
      const raw = asRawText(`
diff --git a/config.ts b/config.ts
--- a/config.ts
+++ b/config.ts
@@ -10,3 +10,3 @@
-const API_KEY = "old_secret_key_123456789012345";
+const API_KEY = "${sk}";
`);
      const { text } = redact(raw);
      expect(text).not.toContain(sk);
      expect(text).toContain('[redacted]');
    });

    it('redacts secrets inside JSON payload lines in logs', () => {
      const gh = 'gh' + 'p_1234567890abcdef1234567890abcdef123456';
      const raw = asRawText(`[2026-08-15 14:22:01] ERROR: Request failed with payload {"auth":{"token":"${gh}","secret":"shhh_private_123"}}`);
      const { text } = redact(raw);
      expect(text).not.toContain(gh);
      expect(text).not.toContain('shhh_private_123');
    });

    it('supports extra user-supplied redaction patterns', () => {
      const raw = asRawText('Employee internal ID is CUST-CORP-99281 and phone is SECRET-9988');
      const { text, count } = redact(raw, [/CUST-CORP-\d+/g, /SECRET-\d+/g]);
      expect(text).not.toContain('CUST-CORP-99281');
      expect(text).not.toContain('SECRET-9988');
      expect(count).toBe(2);
    });

    it('handles clean text with 0 redactions accurately', () => {
      const raw = asRawText('Everything is normal. Node v20.11.0 on Darwin arm64.');
      const { text, count } = redact(raw);
      expect(text).toBe('Everything is normal. Node v20.11.0 on Darwin arm64.');
      expect(count).toBe(0);
    });

    it('redacts multiple secrets on the same line', () => {
      const sk = 'sk_' + 'live_' + '111111111111111111111111';
      const gh = 'gh' + 'p_222222222222222222222222222222222222';
      const raw = asRawText(`KEY1=${sk} KEY2=${gh}`);
      const { text, count } = redact(raw);
      expect(text).not.toContain(sk);
      expect(text).not.toContain(gh);
      expect(count).toBe(2);
    });
  });
});
