/**
 * Markdown fences sized to their content (B-04).
 *
 * Log and diff content is attacker-influenced in ordinary use — a web server
 * logging a request body, a dependency printing untrusted input. Emitting it
 * raw lets a crafted line close the block and forge a section heading in a
 * report the user then pastes into a public issue as an accurate record.
 *
 * A fence one backtick longer than the longest run inside the content cannot
 * be closed from within it.
 */
export function fenceFor(content: string): string {
  const longest = (content.match(/`{3,}/g) ?? []).reduce(
    (max, run) => Math.max(max, run.length),
    2
  );
  return '`'.repeat(longest + 1);
}
