import { asRawText, Collector } from '../types.js';

/**
 * Strips non-printable ASCII and control characters, while preserving tab and standard whitespace.
 */
export function stripBinaryAndControlChars(str: string): string {
  // Strip ANSI color escape codes
  const noAnsi = str.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, '');
  // Strip non-printable control characters (except \t \n \r)
  return noAnsi.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '');
}

/**
 * Sanitizes and truncates lines to a max of 2000 chars per line,
 * and limits output to the last N lines.
 */
export function sanitizeLogContent(content: string, maxLines = 200): string {
  if (!content) return '';

  const clean = stripBinaryAndControlChars(content);
  const rawLines = clean.split(/\r?\n/);

  const sanitizedLines = rawLines.map((line) => {
    if (line.length > 2000) {
      return line.slice(0, 2000) + ' ... [line truncated at 2000 chars]';
    }
    return line;
  });

  // Keep last maxLines
  const sliced = sanitizedLines.slice(-maxLines);
  return sliced.join('\n');
}

export const collectLogs: Collector = async (ctx) => {
  const lineLimit = ctx.lines ?? 200;

  // 1. Wrapped command buffer
  if (ctx.wrapBuffer && ctx.wrapBuffer.trim()) {
    const sanitized = sanitizeLogContent(ctx.wrapBuffer, lineLimit);
    return {
      id: 'logs',
      title: 'Logs',
      status: 'ok',
      rawContent: asRawText(sanitized),
    };
  }

  // 2. Piped stdin input
  if (ctx.stdinLog && ctx.stdinLog.trim()) {
    const sanitized = sanitizeLogContent(ctx.stdinLog, lineLimit);
    return {
      id: 'logs',
      title: 'Logs',
      status: 'ok',
      rawContent: asRawText(sanitized),
    };
  }

  // 3. Default: omitted with reason if no active stream
  return {
    id: 'logs',
    title: 'Logs',
    status: 'unavailable',
    unavailableReason: 'no log stream provided (use --wrap or --stdin)',
  };
};
