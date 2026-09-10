/**
 * Core type definitions for crashpack
 */

declare const __rawTextBrand: unique symbol;
declare const __safeTextBrand: unique symbol;

/**
 * Branded type for unredacted raw strings.
 * Collectors must return RawText.
 */
export type RawText = string & { readonly [__rawTextBrand]: true };

/**
 * Branded type for strings that passed through redaction.
 * This tracks the pipeline, not whether every secret was found.
 * Section.content ONLY accepts SafeText.
 */
export type SafeText = string & { readonly [__safeTextBrand]: true };

/**
 * Helper to cast a raw string into RawText.
 * This is safe because RawText is marked as unredacted and MUST pass through redact().
 */
export function asRawText(value: string): RawText {
  return value as RawText;
}


export type SectionStatus = 'ok' | 'unavailable';

export interface Section {
  id: string;                 // 'logs' | 'git' | 'system' | 'runtimes' | 'packages' | 'docker' | 'ports' | 'env'
  title: string;              // 'Logs', 'Git', etc.
  status: SectionStatus;
  content?: SafeText;         // markdown body, ALREADY REDACTED
  unavailableReason?: SafeText; // required when status === 'unavailable'; ALREADY REDACTED
  durationMs: number;
}

export interface CrashPack {
  projectName: string;
  sections: Section[];
  generatedAt: string;
  durationMs: number;
  redactionCount: number;     // how many values were masked
}

export interface CollectorContext {
  cwd: string;
  timeoutMs?: number;
  lines?: number;
  since?: string;
  stdinLog?: string;
  wrapBuffer?: string;
}

export interface CollectorResult {
  id: string;
  title: string;
  status: SectionStatus;
  rawContent?: RawText;
  unavailableReason?: string;
}

export type Collector = (ctx: CollectorContext) => Promise<CollectorResult>;

export interface RedactResult {
  text: SafeText;
  count: number;
}

export interface CliOptions {
  wrap?: string;
  stdin?: boolean;
  out?: string;
  stdout?: boolean;
  json?: boolean;
  clipboard?: boolean;
  lines?: string;
  since?: string;
  issue?: boolean;
  create?: boolean;
  only?: string;
  skip?: string;
  redactExtra?: string[];
  entropy?: boolean;
}
