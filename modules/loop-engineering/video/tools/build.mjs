// Generates index.html and compositions/{night,loop,morning}.html from beats.json (measured voice timings) and
// narration.json, so every visual cue lands on the word that names it. Rerun after regenerating the voice:
//   node tools/build.mjs
// Voice clips are loudness-normalized with ffmpeg (loudnorm I=-16, TP=-1.5) after tts; the voice lane plays at 0.9 for about -14 LUFS.
// Hand edits made in the HyperFrames app to the generated files are overwritten by a rerun.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const beats = JSON.parse(readFileSync('beats.json', 'utf8'));
const narration = Object.fromEntries(JSON.parse(readFileSync('narration.json', 'utf8')));
const B = Object.fromEntries(beats.map(b => [b.id, b]));
const at = (id, phrase) => {
  const text = narration[id];
  const i = text.indexOf(phrase);
  if (i < 0) throw new Error(`"${phrase}" not in ${id}`);
  return B[id].start + B[id].dur * (i / text.length);
};
const r = n => +n.toFixed(3);

const LOOP_START = B.b02.start;
const MORNING_START = r(B.b13.start - 0.5);
const END = r(B.b14.start + B.b14.dur + 3.2);
const W = 1920, H = 1080;

const C = {
  ground: '#111214', panel: '#17181B', border: '#2C2E33', idle: '#3A3D44', ink: '#E8E8E6', muted: '#9A9CA3',
  blue: '#8FA6FF', coral: '#F0866F', green: '#7FCF97',
  paper: '#FFFFFF', paperInk: '#16181D', paperBlue: '#2348C9', paperGreen: '#22603A', paperRule: '#DFE2E8', paperPanel: '#F6F7F9',
};

const sceneShell = (id, css, body, script, duration) => `<template>
  <style>
    #root { position: absolute; inset: 0; overflow: hidden; }
${css}
  </style>
  <div id="root" data-composition-id="${id}" data-width="${W}" data-height="${H}" data-duration="${duration}">
${body}
  </div>
  <script>
    const tl = gsap.timeline({ paused: true });
${script}
    window.__timelines["${id}"] = tl;
  </script>
</template>
`;

const arrive = (sel, t, extra = '') => `    tl.fromTo("${sel}", { opacity: 0, scale: 0.94, filter: "blur(6px)" }, { opacity: 1, scale: 1, filter: "blur(0px)", duration: 0.5, ease: "expo.out"${extra} }, ${r(t)});`;
const leave = (sel, t, d = 0.25) => `    tl.to("${sel}", { opacity: 0, filter: "blur(6px)", duration: ${d}, ease: "power3.in" }, ${r(t)});`;
const show = (sel, t, d = 0.35) => `    tl.fromTo("${sel}", { opacity: 0 }, { opacity: 1, duration: ${d}, ease: "power2.out" }, ${r(t)});`;

// ---------------------------------------------------------------- shared geometry and camera
const BW = 400, BH = 190;
const NODES = {
  you: [1560, 230, 'You', 'at the keyboard'], goal: [960, 230, 'Goal + budget', 'stopping rule'],
  state: [360, 540, 'progress.md', 'memory'], agent: [960, 540, 'Agent', 'maker'], repo: [1560, 540, 'Repository', 'code and tools'],
  checker: [960, 850, 'Checker', 'its own brief'], tests: [1560, 850, 'Tests', 'feedback'],
};
// Frame the nodes on screen: their boxes plus room for edge labels, centred, never larger than 1.5x.
function frameOn(ids) {
  const xs = ids.flatMap(id => [NODES[id][0] - BW / 2 - 70, NODES[id][0] + BW / 2 + 70]);
  const ys = ids.flatMap(id => [NODES[id][1] - BH / 2 - 60, NODES[id][1] + BH / 2 + 60]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const scale = Math.min(1720 / (x1 - x0), 940 / (y1 - y0), 1.5);
  return { scale: r(scale), x: r(W / 2 - scale * (x0 + x1) / 2), y: r(H / 2 - scale * (y0 + y1) / 2) };
}
const FIRST_FRAME = frameOn(['you', 'agent', 'repo']);

// ---------------------------------------------------------------- night
{
  const t0 = 0; // scene-local = absolute for night
  const lines = [
    ['nt-l2', '✗ checkout.spec › totals   expected 108, received 96', C.coral, at('b01', 'failing')],
    ['nt-l3', 'you   › fix the failing totals test', C.blue, at('b01', 'You paste')],
    ['nt-l4', 'agent › edited src/cart.ts (rounding)', C.muted, at('b01', 'the agent edits')],
    ['nt-l5', '$ npm test', C.ink, at('b01', 'you run')],
    ['nt-l6', '✗ checkout.spec › totals   expected 108, received 107', C.coral, at('b01', 'the tests and')],
    ['nt-l7', 'you   › still failing, try again', C.blue, at('b01', 'type again')],
  ];
  const css = `    #nt-grid { position: absolute; inset: 0; background-color: ${C.ground};
      background-image: linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px);
      background-size: 64px 64px; }
    #nt-term { position: absolute; left: 120px; top: 150px; width: 1240px; height: 760px; background: ${C.panel}; border: 1px solid ${C.border}; border-radius: 10px; overflow: hidden; }
    #nt-bar { height: 64px; display: flex; align-items: center; justify-content: space-between; padding: 0 28px; border-bottom: 1px solid ${C.border};
      font-family: "JetBrains Mono", monospace; font-size: 28px; color: ${C.muted}; }
    #nt-clock { color: ${C.ink}; font-weight: 600; }
    #nt-body { padding: 36px 40px; display: flex; flex-direction: column; gap: 22px; font-family: "JetBrains Mono", monospace; font-size: 34px; white-space: pre; }
    #nt-count { position: absolute; left: 1440px; top: 150px; width: 360px; height: 760px; display: flex; flex-direction: column; justify-content: center; gap: 8px;
      font-family: "JetBrains Mono", monospace; color: ${C.muted}; }
    #nt-count-label { font-size: 28px; }
    #nt-count-num { position: relative; height: 230px; font-size: 220px; font-weight: 600; line-height: 230px; color: ${C.ink}; }
    #nt-count-num span { position: absolute; left: 0; top: 0; }`;
  const body = `    <div id="nt-grid"></div>
    <div id="nt-term">
      <div id="nt-bar"><span>zsh — checkout-service</span><span id="nt-clock">23:47</span></div>
      <div id="nt-body">
        <div id="nt-l1" style="color: ${C.ink};">$ npm test</div>
${lines.map(([id, text, color]) => `        <div id="${id}" style="color: ${color}; opacity: 0;">${text}</div>`).join('\n')}
      </div>
    </div>
    <div id="nt-count" aria-label="Prompt count">
      <div id="nt-count-label">prompt</div>
      <div id="nt-count-num"><span id="nt-n12">12</span><span id="nt-n13" style="opacity: 0;">13</span><span id="nt-n14" style="opacity: 0;">14</span></div>
    </div>`;
  const four = at('b01', 'Prompt fourteen');
  const script = [

    `    tl.fromTo("#nt-clock", { color: "${C.muted}" }, { color: "${C.blue}", duration: 0.3, ease: "power2.inOut" }, ${r(B.b01.start)});`,
    `    tl.to("#nt-clock", { color: "${C.ink}", duration: 0.3, ease: "power2.inOut" }, ${r(at('b01', 'A test'))});`,
    ...lines.map(([id, , , t]) => `    tl.fromTo("#${id}", { opacity: 0, filter: "blur(4px)" }, { opacity: 1, filter: "blur(0px)", duration: 0.18, ease: "power4.out" }, ${r(t)});`),
    `    tl.to("#nt-n12", { opacity: 0, y: -40, duration: 0.18, ease: "power3.in" }, ${r(at('b01', 'type again'))});`,
    `    tl.fromTo("#nt-n13", { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.25, ease: "expo.out" }, ${r(at('b01', 'type again') + 0.12)});`,
    `    tl.to("#nt-n13", { opacity: 0, y: -40, duration: 0.18, ease: "power3.in" }, ${r(four)});`,
    `    tl.fromTo("#nt-n14", { opacity: 0, y: 40, color: "${C.ink}" }, { opacity: 1, y: 0, color: "${C.coral}", duration: 0.3, ease: "expo.out" }, ${r(four + 0.12)});`,
    // The terminal is "you at the keyboard": it shrinks into the You node of the next scene.
    `    tl.to("#nt-count", { opacity: 0, duration: 0.2, ease: "power3.in" }, ${r(LOOP_START - 0.7)});`,
    `    tl.to("#nt-term", { x: ${r(FIRST_FRAME.x + FIRST_FRAME.scale * 1560 - (120 + 620))}, y: ${r(FIRST_FRAME.y + FIRST_FRAME.scale * 230 - (150 + 380))}, scale: ${r(FIRST_FRAME.scale * BW / 1240)}, opacity: 0.55, duration: 0.55, ease: "power3.inOut" }, ${r(LOOP_START - 0.6)});`,
  ].join('\n');
  mkdirSync('compositions', { recursive: true });
  writeFileSync('compositions/night.html', sceneShell('night', css, body, script, r(LOOP_START - t0)));
}

// ---------------------------------------------------------------- loop
{
  const L = t => r(t - LOOP_START);
  const D = r(MORNING_START - LOOP_START);
  const nodes = NODES;
  const notes = {
    you: ['prompt 14 of 14', 'check, decide, verify'], agent: ['act', 'context: full', 'run 40 retries run 3', 'reads progress first'],
    repo: ['feedback', 'test weakened', 'bug: still there'], tests: ['runs every change', 'PASS'],
    checker: ['assume it is broken', 'rejects: weak test', 'accepts: all green'], state: ['39 fixes tried'],
    goal: ['checker OK, or 400k'],
  };
  const edges = [
    ['you-agent', 'you', 'agent', 'prompt', 1], ['agent-you', 'agent', 'you', 'output', 1],
    ['agent-repo', 'agent', 'repo', 'act', 0], ['repo-tests', 'repo', 'tests', 'run', 0], ['tests-agent', 'tests', 'agent', 'result', 0],
    ['agent-checker', 'agent', 'checker', 'claims done', 1], ['checker-agent', 'checker', 'agent', 'findings', 1],
    ['state-agent', 'state', 'agent', 'read', 1], ['agent-state', 'agent', 'state', 'write', 1], ['goal-agent', 'goal', 'agent', 'stop?', 0],
  ];
  const geo = {};
  for (const [id, a, b, , side] of edges) {
    const [ax, ay] = nodes[a], [bx, by] = nodes[b];
    const len = Math.hypot(bx - ax, by - ay), ux = (bx - ax) / len, uy = (by - ay) / len, nx = -uy, ny = ux;
    const off = side * 14;
    const clip = (cx, cy, dx, dy) => { const t = Math.min(dx ? (BW / 2 + 14) / Math.abs(dx) : Infinity, dy ? (BH / 2 + 14) / Math.abs(dy) : Infinity); return [cx + dx * t, cy + dy * t]; };
    const p0 = clip(ax, ay, ux, uy), p1 = clip(bx, by, -ux, -uy);
    const s = [p0[0] + nx * off, p0[1] + ny * off], e = [p1[0] + nx * off, p1[1] + ny * off];
    const ls = side || 1;
    // Beside a mostly vertical line, anchor the label's near edge to the line instead of centring it.
    const vertical = Math.abs(nx * ls) > 0.7;
    const gapPx = vertical ? 22 : 40;
    const mid = [(s[0] + e[0]) / 2 + nx * gapPx * ls, (s[1] + e[1]) / 2 + ny * gapPx * ls];
    const shift = vertical ? (nx * ls > 0 ? 'translate(0, -50%)' : 'translate(-100%, -50%)') : 'translate(-50%, -50%)';
    geo[id] = { s, e, mid, shift };
  }
  const css = `    #lp-grid { position: absolute; inset: 0; background-color: ${C.ground};
      background-image: linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px);
      background-size: 64px 64px; }
    #lp-stage { position: absolute; inset: 0; }
    .lp-node { position: absolute; width: ${BW}px; height: ${BH}px; }
    .lp-box { position: absolute; inset: 0; box-sizing: border-box; padding: 22px 22px; border-radius: 10px; border: 2px solid ${C.idle}; background: ${C.panel}; }
    .lp-label { font-family: Inter, sans-serif; font-weight: 700; font-size: 40px; color: ${C.ink}; letter-spacing: -0.01em; }
    .lp-sub { margin-top: 4px; font-family: "JetBrains Mono", monospace; font-size: 28px; color: ${C.muted}; }
    .lp-note { position: absolute; left: 22px; bottom: 18px; font-family: "JetBrains Mono", monospace; font-size: 28px; font-weight: 600; color: ${C.blue}; white-space: nowrap; }
    .lp-elabel { position: absolute; font-family: "JetBrains Mono", monospace; font-size: 28px; color: ${C.muted}; white-space: nowrap; }
    .lp-pk { position: absolute; left: 0; top: 0; width: 14px; height: 14px; background: ${C.blue}; }
    #lp-title { position: absolute; left: 120px; top: 360px; }
    #lp-title-main { font-family: Inter, sans-serif; font-weight: 700; font-size: 112px; letter-spacing: -0.02em; color: ${C.ink}; }
    #lp-title-sub { margin-top: 18px; font-family: Inter, sans-serif; font-size: 44px; color: ${C.muted}; }
    #lp-title span { display: inline-block; }
    #lp-cell { position: absolute; left: 180px; top: 145px; width: 400px; height: 170px; font-family: "JetBrains Mono", monospace; }
    .lp-cell-label { font-size: 28px; color: ${C.muted}; }
    .lp-cell-num { font-size: 96px; font-weight: 600; line-height: 1.1; color: ${C.ink}; }
    #lp-tokens, #lp-clock { position: absolute; inset: 0; opacity: 0; }`;
  const nodeHtml = Object.entries(nodes).map(([id, [x, y, label, sub]]) => `      <div id="lp-node-${id}" class="lp-node" style="left: ${x - BW / 2}px; top: ${y - BH / 2}px; opacity: 0;">
        <div id="lp-box-${id}" class="lp-box">
          <div class="lp-label">${label}</div>
          <div class="lp-sub">${sub}</div>
${(notes[id] ?? []).map((n, i) => `          <div id="lp-note-${id}-${i}" class="lp-note" style="opacity: 0;">${n}</div>`).join('\n')}
        </div>
      </div>`).join('\n');
  const body = `    <div id="lp-grid"></div>
    <div id="lp-stage" data-layout-allow-overflow>
      <svg id="lp-edges" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="position: absolute; inset: 0;" aria-hidden="true">
        <defs><marker id="lp-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 L10 5 L0 10 z" fill="${C.idle}"/></marker></defs>
${edges.map(([id]) => { const g = geo[id]; return `        <line id="lp-e-${id}" x1="${r(g.s[0])}" y1="${r(g.s[1])}" x2="${r(g.e[0])}" y2="${r(g.e[1])}" stroke="${C.idle}" stroke-width="2" marker-end="url(#lp-arrow)" opacity="0"/>`; }).join('\n')}
      </svg>
${edges.map(([id, , , label]) => `      <div id="lp-el-${id}" class="lp-elabel" style="left: ${r(geo[id].mid[0])}px; top: ${r(geo[id].mid[1])}px; transform: ${geo[id].shift}; opacity: 0;">${label}</div>`).join('\n')}
${nodeHtml}
${edges.map(([id]) => `      <div id="lp-pk-${id}" class="lp-pk" style="opacity: 0;"></div>`).join('\n')}
      <div id="lp-cell">
        <div id="lp-tokens"><div class="lp-cell-label">tokens</div><div id="lp-tokens-num" class="lp-cell-num">610k</div></div>
        <div id="lp-clock"><div class="lp-cell-label">time</div><div id="lp-clock-num" class="lp-cell-num">23:47</div></div>
      </div>
    </div>
    <div id="lp-title" data-hold style="opacity: 0;">
      <div id="lp-title-main"><span id="lp-tw1">Loop</span> <span id="lp-tw2" style="color: ${C.blue};">engineering</span></div>
      <div id="lp-title-sub">Build the system that runs the loop.</div>
    </div>`;

  const s = [];
  const states = {
    idle: { backgroundColor: C.panel, borderColor: C.idle, opacity: 1 },
    active: { backgroundColor: 'rgba(143,166,255,0.14)', borderColor: C.blue, opacity: 1 },
    fail: { backgroundColor: 'rgba(240,134,111,0.16)', borderColor: C.coral, opacity: 1 },
    ok: { backgroundColor: 'rgba(127,207,151,0.14)', borderColor: C.green, opacity: 1 },
    muted: { backgroundColor: C.ground, borderColor: C.border, opacity: 0.4 },
  };
  const nodeIn = (id, t) => s.push(arrive(`#lp-node-${id}`, L(t)));
  const nodeSet = (id, t) => s.push(`    tl.set("#lp-node-${id}", { opacity: 1 }, ${L(t)});`);
  const state = (id, kind, t) => s.push(`    tl.to("#lp-box-${id}", ${JSON.stringify({ ...states[kind], duration: 0.3, ease: 'power2.inOut' }).replace(/"(\w+)":/g, '$1: ')}, ${L(t)});`);
  const shown = {};
  const note = (id, i, t) => {
    if (shown[id] !== undefined) s.push(`    tl.to("#lp-note-${id}-${shown[id]}", { opacity: 0, duration: 0.15, ease: "power3.in" }, ${L(t)});`);
    s.push(`    tl.fromTo("#lp-note-${id}-${i}", { opacity: 0, filter: "blur(4px)" }, { opacity: 1, filter: "blur(0px)", duration: 0.2, ease: "power4.out" }, ${r(L(t) + 0.1)});`);
    shown[id] = i;
  };
  const noteColor = (id, i, color) => s.push(`    tl.set("#lp-note-${id}-${i}", { color: "${color}" }, 0);`);
  const edgeIn = (id, t) => { s.push(show(`#lp-e-${id}`, L(t), 0.4)); s.push(show(`#lp-el-${id}`, L(t) + 0.1, 0.3)); };
  const edgeDim = (id, t, o = 0.25) => s.push(`    tl.to(["#lp-e-${id}", "#lp-el-${id}"], { opacity: ${o}, duration: 0.3, ease: "power2.inOut" }, ${L(t)});`);
  const flow = (chain, t0, t1, tone = 'signal', period = 1.1) => {
    const color = tone === 'fail' ? C.coral : C.blue;
    chain.forEach((id, i) => {
      const g = geo[id];
      const start = L(t0) + i * (period * 0.5);
      const reps = Math.max(1, Math.floor((L(t1) - start) / period));
      s.push(`    tl.set("#lp-pk-${id}", { opacity: 1, backgroundColor: "${color}" }, ${r(start)});`);
      for (let k = 0; k < reps; k++) {
        s.push(`    tl.fromTo("#lp-pk-${id}", { x: ${r(g.s[0] - 7)}, y: ${r(g.s[1] - 7)} }, { x: ${r(g.e[0] - 7)}, y: ${r(g.e[1] - 7)}, duration: ${period}, ease: "none", immediateRender: false }, ${r(start + k * period)});`);
      }
      s.push(`    tl.set("#lp-pk-${id}", { opacity: 0 }, ${r(start + reps * period)});`);
    });
  };

  const camera = (ids, t, d = 1.2) => { const f = frameOn(ids); s.push(`    tl.to("#lp-stage", { x: ${f.x}, y: ${f.y}, scale: ${f.scale}, duration: ${d}, ease: "power2.inOut" }, ${L(t)});`); };
  s.push(`    tl.set("#lp-stage", { transformOrigin: "0 0", x: ${FIRST_FRAME.x}, y: ${FIRST_FRAME.y}, scale: ${FIRST_FRAME.scale} }, 0);`);
  // b02: you are the loop. The You node is already in place, where the terminal shrank to.
  nodeSet('you', LOOP_START); state('you', 'active', LOOP_START);
  nodeIn('agent', LOOP_START + 0.15); nodeIn('repo', LOOP_START + 0.3);
  ['you-agent', 'agent-repo', 'agent-you'].forEach((e, i) => edgeIn(e, LOOP_START + 0.5 + i * 0.15));
  note('you', 0, at('b02', 'Every turn'));
  flow(['you-agent', 'agent-repo', 'agent-you'], Math.max(at('b02', 'Follow'), LOOP_START + 1.0), B.b04.start - 0.2, 'signal', 1.4);
  state('agent', 'active', at('b02', 'The agent does')); state('agent', 'idle', at('b02', 'You do'));
  // b03: the five steps, and who does them.
  note('you', 1, at('b03', 'Check state')); note('agent', 0, at('b03', 'Act.')); note('repo', 0, at('b03', 'Gather'));
  state('you', 'idle', at('b03', 'Every working')); state('you', 'active', at('b03', 'four of them'));
  // b04: the title over the dimmed loop.
  s.push(`    tl.to("#lp-stage", { opacity: 0.16, filter: "blur(6px)", duration: 0.4, ease: "power2.inOut" }, ${L(B.b04.start - 0.1)});`);
  s.push(`    tl.set("#lp-title", { opacity: 1 }, ${L(B.b04.start)});`);
  s.push(`    tl.fromTo(["#lp-tw1", "#lp-tw2"], { opacity: 0, filter: "blur(6px)" }, { opacity: 1, filter: "blur(0px)", duration: 0.13, ease: "power4.out", stagger: 0.067 }, ${L(B.b04.start + 0.05)});`);
  s.push(`    tl.fromTo("#lp-title-sub", { opacity: 0, filter: "blur(6px)" }, { opacity: 1, filter: "blur(0px)", duration: 0.2, ease: "power4.out" }, ${L(at('b04', 'building'))});`);
  s.push(leave('#lp-title', L(B.b04.start + B.b04.dur + 0.05), 0.25));
  s.push(`    tl.to("#lp-stage", { opacity: 1, filter: "blur(0px)", duration: 0.4, ease: "power2.inOut" }, ${L(B.b04.start + B.b04.dur + 0.15)});`);
  // b05: feedback.
  camera(['you', 'agent', 'repo', 'tests'], at('b05', 'Tests run') - 0.8);
  nodeIn('tests', at('b05', 'Tests run')); edgeIn('repo-tests', at('b05', 'Tests run') + 0.2); edgeIn('tests-agent', at('b05', 'Tests run') + 0.35);
  note('tests', 0, at('b05', 'after every'));
  flow(['agent-repo', 'repo-tests', 'tests-agent'], at('b05', 'after every'), B.b05.start + B.b05.dur + 0.4);
  state('you', 'muted', at('b05', 'so the agent')); edgeDim('you-agent', at('b05', 'so the agent')); edgeDim('agent-you', at('b05', 'so the agent'), 0.5);
  s.push(`    tl.to("#lp-note-you-1", { opacity: 0, duration: 0.15, ease: "power3.in" }, ${L(at('b05', 'so the agent'))});`);
  // b06: the false pass.
  flow(['agent-you'], at('b06', 'Then it says'), at('b06', 'The tests pass'));
  state('tests', 'ok', at('b06', 'The tests pass')); noteColor('tests', 1, C.green); note('tests', 1, at('b06', 'The tests pass'));
  state('repo', 'fail', at('b06', 'weakened')); noteColor('repo', 1, C.coral); note('repo', 1, at('b06', 'weakened'));
  noteColor('repo', 2, C.coral); note('repo', 2, at('b06', 'The bug'));
  // b07: a separate checker.
  camera(['you', 'agent', 'repo', 'tests', 'checker'], at('b07', 'add a checker') - 0.8);
  nodeIn('checker', at('b07', 'add a checker')); edgeIn('agent-checker', at('b07', 'add a checker') + 0.25); edgeIn('checker-agent', at('b07', 'add a checker') + 0.4);
  state('tests', 'idle', at('b07', 'add a checker'));
  s.push(`    tl.to("#lp-note-tests-1", { opacity: 0, duration: 0.15, ease: "power3.in" }, ${L(at('b07', 'add a checker'))});`);
  state('checker', 'active', at('b07', 'own brief')); note('checker', 0, at('b07', 'Assume'));
  flow(['agent-checker'], at('b07', 'own brief'), at('b07', 'It reads'));
  noteColor('checker', 1, C.coral); note('checker', 1, at('b07', 'It reads'));
  flow(['checker-agent'], at('b07', 'It reads'), B.b07.start + B.b07.dur + 0.4, 'fail');
  // b08: forgetting.
  state('checker', 'idle', B.b08.start); state('repo', 'idle', B.b08.start);
  s.push(`    tl.to("#lp-note-repo-2", { opacity: 0, duration: 0.15, ease: "power3.in" }, ${L(B.b08.start)});`);
  state('agent', 'fail', at('b08', 'the context')); noteColor('agent', 1, C.coral); note('agent', 1, at('b08', 'the context'));
  noteColor('agent', 2, C.coral); note('agent', 2, at('b08', 'At run forty'));
  flow(['agent-repo', 'repo-tests', 'tests-agent'], at('b08', 'An hour'), B.b08.start + B.b08.dur + 0.3, 'signal', 0.8);
  // b09: memory.
  camera(['you', 'agent', 'repo', 'tests', 'checker', 'state'], at('b09', 'Keep state') - 0.8);
  nodeIn('state', at('b09', 'Keep state')); edgeIn('state-agent', at('b09', 'Keep state') + 0.25); edgeIn('agent-state', at('b09', 'Keep state') + 0.4);
  note('state', 0, at('b09', 'A progress file'));
  flow(['state-agent'], at('b09', 'it reads'), at('b09', 'and updates'));
  state('agent', 'idle', at('b09', 'it reads')); note('agent', 3, at('b09', 'it reads'));
  flow(['agent-state'], at('b09', 'and updates'), B.b09.start + B.b09.dur + 0.4);
  // b10: runaway. The token counter takes the empty cell.
  s.push(`    tl.to("#lp-tokens", { opacity: 1, duration: 0.3, ease: "power2.out" }, ${L(at('b10', 'Now nothing'))});`);
  s.push(`    const tok = { v: 610 };`);
  s.push(`    tl.to(tok, { v: 1480, duration: ${r(B.b10.dur)}, ease: "power1.in", onUpdate: () => { const v = Math.round(tok.v); document.querySelector("#lp-tokens-num").textContent = v >= 1000 ? (v / 1000).toFixed(2) + "M" : v + "k"; } }, ${L(at('b10', 'Now nothing'))});`);
  s.push(`    tl.to("#lp-tokens-num", { color: "${C.coral}", duration: 0.4, ease: "power2.inOut" }, ${L(at('b10', 'burns'))});`);
  flow(['agent-repo', 'repo-tests', 'tests-agent', 'agent-checker', 'checker-agent', 'state-agent'], at('b10', 'Now nothing'), B.b10.start + B.b10.dur + 0.3, 'signal', 0.55);
  s.push(`    tl.to("#lp-note-agent-3", { opacity: 0, duration: 0.15, ease: "power3.in" }, ${L(at('b10', 'Now nothing'))});`);
  // b11: stopping rule.
  nodeIn('goal', at('b11', 'Write the stopping')); edgeIn('goal-agent', at('b11', 'Write the stopping') + 0.25);
  state('goal', 'active', at('b11', 'A goal')); note('goal', 0, at('b11', 'A goal'));
  flow(['goal-agent'], at('b11', 'A goal'), B.b11.start + B.b11.dur);
  s.push(`    tl.to("#lp-tokens-num", { color: "${C.muted}", duration: 0.3, ease: "power2.inOut" }, ${L(at('b11', 'and a budget'))});`);
  state('checker', 'ok', at('b11', 'It stops')); noteColor('checker', 2, C.green); note('checker', 2, at('b11', 'It stops'));
  // b12: close the laptop. You leaves; the loop keeps turning; the night passes.
  s.push(leave('#lp-tokens', L(B.b12.start), 0.2));
  s.push(`    tl.to("#lp-node-you", { opacity: 0, filter: "blur(6px)", duration: 0.6, ease: "power3.in" }, ${L(at('b12', 'close'))});`);
  s.push(`    tl.to(["#lp-e-you-agent", "#lp-el-you-agent", "#lp-e-agent-you", "#lp-el-agent-you"], { opacity: 0, duration: 0.4, ease: "power3.in" }, ${L(at('b12', 'close'))});`);
  state('goal', 'idle', B.b12.start);
  s.push(`    tl.to("#lp-clock", { opacity: 1, duration: 0.3, ease: "power2.out" }, ${L(at('b12', 'The loop'))});`);
  s.push(`    const clk = { m: ${23 * 60 + 47} };`);
  s.push(`    tl.to(clk, { m: ${31 * 60 + 10}, duration: ${r(MORNING_START - at('b12', 'The loop') - 0.6)}, ease: "power2.inOut", onUpdate: () => { const m = Math.round(clk.m) % 1440; document.querySelector("#lp-clock-num").textContent = String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0"); } }, ${L(at('b12', 'The loop') + 0.2)});`);
  flow(['agent-repo', 'repo-tests', 'tests-agent', 'agent-checker', 'checker-agent', 'state-agent', 'agent-state'], at('b12', 'The loop'), MORNING_START, 'signal', 0.9);

  writeFileSync('compositions/loop.html', sceneShell('loop', css, body, s.join('\n'), D));
}

// ---------------------------------------------------------------- morning
{
  const M = t => r(t - MORNING_START);
  const D = r(END - MORNING_START);
  const lines = [
    ['mn-l1', '✓  checkout.spec › totals', 'passed', C.paperGreen, at('b13', 'The build')],
    ['mn-l2', '✓  checker', 'accepted the diff', C.paperGreen, at('b13', 'the checker')],
    ['mn-l3', '→  progress.md', '41 runs · report written', C.paperBlue, at('b13', 'a report')],
  ];
  const css = `    #mn-ground { position: absolute; inset: 0; background: ${C.ground}; }
    #mn-clock { position: absolute; left: 120px; top: 150px; font-family: "JetBrains Mono", monospace; font-weight: 600; font-size: 120px; color: ${C.paperInk}; }
    #mn-panel { position: absolute; left: 120px; top: 380px; width: 1280px; box-sizing: border-box; padding: 40px 48px; border-radius: 16px; background: ${C.paperPanel}; border: 1px solid ${C.paperRule};
      display: flex; flex-direction: column; gap: 28px; font-family: "JetBrains Mono", monospace; font-size: 36px; }
    .mn-line { display: flex; gap: 40px; }
    .mn-what { width: 640px; font-weight: 600; }
    .mn-result { color: #3D424C; }
    #mn-claim { position: absolute; left: 120px; top: 360px; width: 1600px; font-family: Inter, sans-serif; font-weight: 700; color: ${C.paperInk}; letter-spacing: -0.02em; }
    #mn-claim-1 { font-size: 60px; color: #5B606B; }
    #mn-claim-2 { margin-top: 24px; font-size: 92px; line-height: 1.05; white-space: nowrap; }`;
  const body = `    <div id="mn-ground"></div>
    <div id="mn-clock" style="opacity: 0;">07:10</div>
    <div id="mn-panel" style="opacity: 0;">
${lines.map(([id, what, result, color]) => `      <div id="${id}" class="mn-line" style="opacity: 0;"><span class="mn-what" style="color: ${color};">${what}</span><span class="mn-result">${result}</span></div>`).join('\n')}
    </div>
    <div id="mn-claim">
      <div id="mn-claim-1" style="opacity: 0;">Stop writing the prompt that drives the agent.</div>
      <div id="mn-claim-2" style="opacity: 0;">Write the <span style="color: ${C.paperBlue};">system</span> that prompts it.</div>
    </div>`;
  const script = [
    `    tl.to("#mn-ground", { backgroundColor: "${C.paper}", duration: 0.4, ease: "power2.inOut" }, 0.05);`,
    arrive('#mn-clock', M(B.b13.start)),
    show('#mn-panel', M(B.b13.start + 0.3), 0.3),
    ...lines.map(([id, , , , t]) => `    tl.fromTo("#${id}", { opacity: 0, filter: "blur(4px)" }, { opacity: 1, filter: "blur(0px)", duration: 0.2, ease: "power4.out" }, ${M(t)});`),
    leave('#mn-clock', M(B.b14.start - 0.3), 0.22),
    leave('#mn-panel', M(B.b14.start - 0.3), 0.22),
    `    tl.fromTo("#mn-claim-1", { opacity: 0, filter: "blur(8px)" }, { opacity: 1, filter: "blur(0px)", duration: 0.2, ease: "power4.out" }, ${M(B.b14.start)});`,
    `    tl.fromTo("#mn-claim-2", { opacity: 0, filter: "blur(8px)" }, { opacity: 1, filter: "blur(0px)", duration: 0.2, ease: "power4.out" }, ${M(at('b14', 'Write the system'))});`,
  ].join('\n');
  writeFileSync('compositions/morning.html', sceneShell('morning', css, body, script, D));
}

// ---------------------------------------------------------------- root
{
  const scenes = [['night', 0, LOOP_START], ['loop', LOOP_START, MORNING_START], ['morning', MORNING_START, END]];
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=${W}, height=${H}" />
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js"></script>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { margin: 0; width: ${W}px; height: ${H}px; overflow: hidden; background: ${C.ground}; }
      #root { position: relative; width: 100%; height: 100%; font-family: Inter, sans-serif; }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="${END}" data-width="${W}" data-height="${H}">
${scenes.map(([id, s0, s1]) => `      <div id="${id}" data-composition-id="${id}" data-composition-src="compositions/${id}.html" data-start="${r(s0)}" data-duration="${r(s1 - s0)}" data-track-index="1" data-track-kind="graphics" data-width="${W}" data-height="${H}"></div>`).join('\n')}
${beats.map(b => `      <audio id="vo-${b.id}" class="clip" src="assets/voice/${b.id}.wav" data-start="${b.start}" data-duration="${b.dur}" data-track-index="3" data-volume="0.9"></audio>`).join('\n')}
    </div>
    <script>
      const tl = gsap.timeline({ paused: true });
      window.__timelines["main"] = tl;
    </script>
  </body>
</html>
`;
  writeFileSync('index.html', html);
}
console.log(`built: night 0–${LOOP_START}, loop ${LOOP_START}–${MORNING_START}, morning ${MORNING_START}–${END}`);
