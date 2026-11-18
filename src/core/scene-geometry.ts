// Where a lesson scene puts things, in SVG pixels. Scene.tsx draws from these numbers and scripts/check-lesson.mjs
// measures with them (Node strips the types), so the authoring check sees exactly what the reader sees.

export type Point = { x: number; y: number };
export type Box = { x: number; y: number; w: number; h: number };

export const layouts = {
  wide: { w: 860, h: 540, nodeW: 172, nodeH: 66, label: 21, sub: 14, x0: 30, xs: 8, y0: 40, ys: 4.6, compact: false },
  compact: { w: 620, h: 520, nodeW: 140, nodeH: 54, label: 19, sub: 0, x0: 60, xs: 5, y0: 50, ys: 4.6, compact: true },
};
export type Layout = typeof layouts.wide | typeof layouts.compact;

// Text metrics for the check: edge labels are 14px and notes 15px italic Manrope, about 0.55em per character.
export const edgeLabelSize = 14;
export const noteSize = 15;
export const noteOffset = 26;
const charWidth = (size: number) => size * .55;

// Node labels are bold and set larger (layout.label px); about 0.5em per character, with 8px of padding in the box.
export function labelFits(label: string, layout: Layout) {
  return label.length * layout.label * .5 <= layout.nodeW - 8;
}

export function nodeCenter(node: { x: number; y: number }, layout: Layout): Point {
  return { x: layout.x0 + node.x * layout.xs, y: layout.y0 + node.y * layout.ys };
}

export function nodeBox(node: { x: number; y: number }, layout: Layout): Box {
  const c = nodeCenter(node, layout);
  return { x: c.x - layout.nodeW / 2, y: c.y - layout.nodeH / 2, w: layout.nodeW, h: layout.nodeH };
}

export function exitPoint(center: Point, toward: Point, halfW: number, halfH: number): Point {
  const dx = toward.x - center.x, dy = toward.y - center.y;
  const t = Math.min(dx ? halfW / Math.abs(dx) : Infinity, dy ? halfH / Math.abs(dy) : Infinity);
  return { x: center.x + dx * t, y: center.y + dy * t };
}

export function edgeGeometry(a: Point, b: Point, bend: number, layout: Layout) {
  const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const control = { x: (a.x + b.x) / 2 - ((b.y - a.y) / length) * bend * 3.2, y: (a.y + b.y) / 2 + ((b.x - a.x) / length) * bend * 3.2 };
  const start = exitPoint(a, control, layout.nodeW / 2 + 6, layout.nodeH / 2 + 6);
  const end = exitPoint(b, control, layout.nodeW / 2 + 10, layout.nodeH / 2 + 10);
  const at = (t: number): Point => ({
    x: (1 - t) ** 2 * start.x + 2 * (1 - t) * t * control.x + t ** 2 * end.x,
    y: (1 - t) ** 2 * start.y + 2 * (1 - t) * t * control.y + t ** 2 * end.y,
  });
  const mid = at(.5);
  // Labels sit beside the line, on the side the curve bends toward, so packets travelling the line never cover them.
  const side = bend >= 0 ? 1 : -1;
  const normal = { x: -((b.y - a.y) / length) * side, y: ((b.x - a.x) / length) * side };
  const label = { x: mid.x + normal.x * 14, y: mid.y + normal.y * 14 + 5, anchor: normal.x > .5 ? 'start' : normal.x < -.5 ? 'end' : 'middle' } as const;
  return { d: `M${start.x.toFixed(1)} ${start.y.toFixed(1)} Q${control.x.toFixed(1)} ${control.y.toFixed(1)} ${end.x.toFixed(1)} ${end.y.toFixed(1)}`, mid, label, at };
}

export function edgeLabelBox(label: { x: number; y: number; anchor: 'start' | 'middle' | 'end' }, text: string): Box {
  const w = text.length * charWidth(edgeLabelSize);
  const x = label.anchor === 'start' ? label.x : label.anchor === 'end' ? label.x - w : label.x - w / 2;
  return { x, y: label.y - edgeLabelSize * .8, w, h: edgeLabelSize };
}

export function noteBox(node: { x: number; y: number }, text: string, layout: Layout): Box {
  const c = nodeCenter(node, layout);
  const w = text.length * charWidth(noteSize);
  const baseline = c.y + layout.nodeH / 2 + noteOffset;
  return { x: c.x - w / 2, y: baseline - noteSize * .8, w, h: noteSize };
}
