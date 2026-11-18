// Lesson prose uses a tiny inline syntax instead of HTML, so generated lessons cannot inject markup:
//   **strong**   *emphasis*   `code`   [[defined term]]
// Unmatched markers are kept as literal text.

export type InlinePart = { kind: 'text' | 'strong' | 'em' | 'code' | 'term'; text: string };

const pattern = /\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`|\[\[([^\]]+)\]\]/g;

export function parseInline(source: string): InlinePart[] {
  const parts: InlinePart[] = [];
  let last = 0;
  for (const match of source.matchAll(pattern)) {
    if (match.index > last) parts.push({ kind: 'text', text: source.slice(last, match.index) });
    const [, strong, em, code, term] = match;
    if (strong !== undefined) parts.push({ kind: 'strong', text: strong });
    else if (em !== undefined) parts.push({ kind: 'em', text: em });
    else if (code !== undefined) parts.push({ kind: 'code', text: code });
    else parts.push({ kind: 'term', text: term ?? '' });
    last = match.index + match[0].length;
  }
  if (last < source.length) parts.push({ kind: 'text', text: source.slice(last) });
  return parts;
}

export function plainText(source: string): string {
  return parseInline(source).map(part => part.text).join('');
}
