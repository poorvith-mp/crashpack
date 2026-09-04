import { RawText, RedactResult, SafeText } from '../types.js';

import { SECRET_PATTERNS } from './patterns.js';
import { redactHighEntropy } from './entropy.js';

/**
 * The only way to mint SafeText. Deliberately module-private: exporting it
 * would let any library consumer forge SafeText and bypass the gate (B-13).
 */
function unsafeMakeSafeText(value: string): SafeText {
  return value as SafeText;
}


export interface RedactOptions {
  /** Generic high-entropy fallback. On by default; --no-entropy turns it off. */
  entropy?: boolean;
}

/**
 * Mandated Redaction Pass-through Engine.
 * 
 * Every collector returns RawText, and only this function can produce SafeText.
 * Bias toward over-redaction.
 */
export function redact(
  input: RawText | string,
  extraPatterns?: RegExp[],
  options: RedactOptions = {},
): RedactResult {
  if (!input) {
    return {
      text: unsafeMakeSafeText(''),
      count: 0,
    };
  }

  let current = String(input);
  let totalRedactions = 0;

  // Run predefined gitleaks-based secret patterns
  for (const pattern of SECRET_PATTERNS) {
    // Reset regex index if global
    pattern.regex.lastIndex = 0;

    if (typeof pattern.replacement === 'function') {
      current = current.replace(pattern.regex, (match, ...args) => {
        const res = (pattern.replacement as Function)(match, ...args);
        if (res !== match) {
          totalRedactions++;
        }
        return res;
      });
    } else {
      const rep = pattern.replacement ?? '[redacted]';
      current = current.replace(pattern.regex, (match) => {
        if (match !== rep) {
          totalRedactions++;
        }
        return rep;
      });
    }
  }

  // Run any user-supplied extra patterns
  if (extraPatterns && extraPatterns.length > 0) {
    for (const regex of extraPatterns) {
      regex.lastIndex = 0;
      current = current.replace(regex, (match) => {
        if (match !== '[redacted]') {
          totalRedactions++;
        }
        return '[redacted]';
      });
    }
  }

  // Generic fallback runs last: anything already replaced above is inert.
  if (options.entropy !== false) {
    const fallback = redactHighEntropy(current);
    current = fallback.text;
    totalRedactions += fallback.count;
  }

  return {
    text: unsafeMakeSafeText(current),
    count: totalRedactions,
  };
}
