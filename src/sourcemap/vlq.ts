const CHAR_TO_INT: Record<string, number> = {};
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
for (let i = 0; i < B64.length; i++) {
  CHAR_TO_INT[B64[i]] = i;
}

/**
 * Decode a Base64 VLQ encoded string to an array of integers.
 */
export function decodeVlq(str: string): number[] {
  const result: number[] = [];
  let index = 0;
  const len = str.length;

  while (index < len) {
    let value = 0;
    let shift = 0;
    let continuation = false;
    let valid = false;

    do {
      if (index >= len) break;
      const char = str[index++];
      const digit = CHAR_TO_INT[char];
      if (digit === undefined) break;

      valid = true;
      continuation = (digit & 32) !== 0;
      value += (digit & 31) << shift;
      shift += 5;
    } while (continuation);

    if (valid) {
      const isNegative = (value & 1) !== 0;
      value >>>= 1;
      result.push(isNegative ? -value : value);
    }
  }
  return result;
}

/**
 * Decode a single VLQ segment (up to delimiter ',' or ';') starting at startIndex.
 */
export function decodeVlqSegment(str: string, startIndex: number): { values: number[]; length: number } {
  const values: number[] = [];
  let index = startIndex;
  const len = str.length;

  while (index < len) {
    const char = str[index];
    if (char === ',' || char === ';') break;

    let value = 0;
    let shift = 0;
    let continuation = false;
    let valid = false;

    do {
      if (index >= len) break;
      const c = str[index++];
      const digit = CHAR_TO_INT[c];
      if (digit === undefined) break;

      valid = true;
      continuation = (digit & 32) !== 0;
      value += (digit & 31) << shift;
      shift += 5;
    } while (continuation);

    if (valid) {
      const isNegative = (value & 1) !== 0;
      value >>>= 1;
      values.push(isNegative ? -value : value);
    }
  }
  return { values, length: index - startIndex };
}
