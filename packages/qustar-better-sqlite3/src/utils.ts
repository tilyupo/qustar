export function indent(s: string, depth = 1): string {
  return s
    .split('\n')
    .map(x => '  '.repeat(depth) + x)
    .join('\n');
}
