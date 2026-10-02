/**
 * Secret detection regex patterns referenced from standard gitleaks rules.
 */

export interface PatternRule {
  id: string;
  regex: RegExp;
  replacement?: string | ((match: string, ...args: any[]) => string);
}

export const SECRET_PATTERNS: PatternRule[] = [
  // Multi-line Private Keys (RSA, OPENSSH, EC, DSA, PGP, etc.)
  {
    id: 'private-key',
    regex: /-----BEGIN\s+[A-Z0-9_\s-]+PRIVATE KEY-----[\s\S]*?-----END\s+[A-Z0-9_\s-]+PRIVATE KEY-----/g,
    replacement: '[redacted private key]',
  },
  // AWS Access Key ID
  {
    id: 'aws-access-key',
    regex: /\b(?:A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}\b/g,
    replacement: '[redacted]',
  },
  // Stripe API Keys (secret, publishable, restricted for live & test)
  {
    id: 'stripe-key',
    regex: /\b(?:sk|pk|rk)_(?:live|test)_[0-9a-zA-Z_]{6,}\b/g,
    replacement: '[redacted]',
  },
  // GitHub Personal Access Tokens, OAuth, Refresh, and App Tokens
  {
    id: 'github-token',
    regex: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{6,255}\b|\bgithub_pat_[A-Za-z0-9_]{10,255}\b/g,
    replacement: '[redacted]',
  },
  // JWT Tokens (3 base64url encoded parts starting with eyJ)
  {
    id: 'jwt',
    regex: /\beyJ[A-Za-z0-9-_]{8,}\.[A-Za-z0-9-_]{8,}\.[A-Za-z0-9-_]{8,}\b/g,
    replacement: '[redacted]',
  },
  // Connection strings with embedded credentials (including empty username like redis://:password@host)
  {
    id: 'connection-string-credentials',
    regex: /((?:postgres|postgresql|mysql|mongodb|mongodb\+srv|redis|rediss|amqp|amqps|couchdb|neo4j|mssql|cassandra):\/\/[^\s@\/:]*:)([^@\s\/]+)(@[^\s\/]+)/g,
    replacement: (_match: string, p1: string, _p2: string, p3: string) => `${p1}[redacted]${p3}`,
  },
  // Bearer tokens in headers or logs
  {
    id: 'bearer-token',
    regex: /\bBearer\s+[A-Za-z0-9\-._~+/]{6,}=*/gi,
    replacement: 'Bearer [redacted]',
  },
  // Basic-auth credentials in http(s) URLs. Username is kept: knowing WHICH
  // account failed is the diagnostic value; the password is the secret.
  {
    id: 'basic-auth-url',
    regex: /\b(https?:\/\/)([^\s:@/]+):([^\s@/]+)@/g,
    replacement: (_match: string, scheme: string, user: string) => `${scheme}${user}:[redacted]@`,
  },
  // Anthropic API keys (before openai-key: 'sk-ant-' must not fall through)
  {
    id: 'anthropic-key',
    regex: /\bsk-ant-(?:api|admin)[0-9]{2}-[A-Za-z0-9_-]{20,}\b/g,
    replacement: '[redacted]',
  },
  // OpenAI project, service-account, admin and legacy keys
  {
    id: 'openai-key',
    regex: /\bsk-(?:proj|svcacct|admin)-[A-Za-z0-9_-]{20,}\b|\bsk-[A-Za-z0-9]{32,}\b/g,
    replacement: '[redacted]',
  },
  // Google / Firebase API keys
  {
    id: 'google-api-key',
    regex: /\bAIza[0-9A-Za-z_-]{35,}\b/g,
    replacement: '[redacted]',
  },
  // SendGrid API keys
  {
    id: 'sendgrid-key',
    regex: /\bSG\.[A-Za-z0-9_-]{16,32}\.[A-Za-z0-9_-]{16,64}\b/g,
    replacement: '[redacted]',
  },
  // Slack incoming-webhook URLs (posting to one is as good as holding a token)
  {
    id: 'slack-webhook',
    regex: /https:\/\/hooks\.slack\.com\/services\/T[A-Za-z0-9]+\/B[A-Za-z0-9]+\/[A-Za-z0-9]+/g,
    replacement: '[redacted]',
  },
  // HuggingFace access tokens
  {
    id: 'huggingface-token',
    regex: /\bhf_[A-Za-z0-9]{30,}\b/g,
    replacement: '[redacted]',
  },
  // GitLab personal access tokens
  {
    id: 'gitlab-pat',
    regex: /\bglpat-[A-Za-z0-9_-]{20,}\b/g,
    replacement: '[redacted]',
  },
  // Telegram bot tokens
  {
    id: 'telegram-bot-token',
    regex: /\b\d{8,10}:AA[A-Za-z0-9_-]{33}\b/g,
    replacement: '[redacted]',
  },
  // Twilio account and API SIDs
  {
    id: 'twilio-sid',
    regex: /\b(?:SK|AC)[0-9a-fA-F]{32}\b/g,
    replacement: '[redacted]',
  },
  // Doppler service and personal tokens
  {
    id: 'doppler-token',
    regex: /\bdp\.(?:pt|st|ct|sa)\.[A-Za-z0-9]{40,}\b/g,
    replacement: '[redacted]',
  },
  // Linear API keys
  {
    id: 'linear-key',
    regex: /\blin_api_[A-Za-z0-9]{40,}\b/g,
    replacement: '[redacted]',
  },
  // Sensitive key assignments in env/config/JSON (e.g. STRIPE_SECRET_KEY=..., "password": "...", API_TOKEN = ...)
  // B-03: the unquoted alternative allows spaces so a passphrase cannot leak
  // past its first token, but still stops at structural delimiters so a later
  // key/value pair on the same JSON line is matched separately (see drift.md).
  {
    id: 'sensitive-key-assignment',
    regex: /((?:^|[\s,;{(\[`])['"]?[A-Za-z0-9_]*(?:SECRET|TOKEN|PASSWORD|PASSWD|KEY|CREDENTIAL|AUTH|PRIVATE|APIKEY|API_KEY)[A-Za-z0-9_]*['"]?\s*[:=]\s*)(?:'[^']*'|"[^"]*"|`[^`]*`|Bearer\s+(?:\[redacted[^\]]*\]|\S+)|\[redacted[^\]]*\]|[^\n\r,;{}()\[\]'"`]+)/gim,
    replacement: (_match: string, prefix: string) => {
      // If the matched key is just the English label "Keys:" in summary lists, don't redact
      if (/^\s*Keys\s*:\s*$/i.test(prefix.trim())) {
        return _match;
      }
      if (_match.includes('[redacted')) {
        return _match;
      }
      if (/\bBearer\s+/i.test(_match)) {
        return `${prefix}Bearer [redacted]`;
      }
      return `${prefix}[redacted]`;
    },
  },
  // Slack Tokens
  {
    id: 'slack-token',
    regex: /\bxox[baprs]-[0-9a-zA-Z-]{10,}\b/g,
    replacement: '[redacted]',
  },
  // NPM Access Tokens
  {
    id: 'npm-token',
    regex: /\bnpm_[A-Za-z0-9]{36,}\b/g,
    replacement: '[redacted]',
  },
  // Generic high-entropy hex strings (32-64 characters in key/secret context)
  {
    id: 'generic-hex-secret',
    regex: /(?<=(?:secret|key|token|auth|signature)["']?\s*[:=]\s*["']?)[a-fA-F0-9]{32,64}(?=["'\s,;]|$)/gi,
    replacement: '[redacted]',
  },
  // Windows User profile directory paths
  {
    id: 'user-home-path',
    regex: /[a-zA-Z]:[\\/]Users[\\/][a-zA-Z0-9_.-]+/gi,
    replacement: '~',
  },
  // Conventional Linux/macOS home prefixes; keep project-relative locations.
  {
    id: 'unix-home-path',
    regex: /(?<![\w/])(?:\/(?:home|Users)\/[^/\s"'`()[\]:]+|\/root(?=$|[/\s"'`()[\]:]))/g,
    replacement: '~',
  },
];
