"use client";

import { useEffect, useRef, useState } from 'react';
import type { Lesson, LessonStep } from '@/src/core';
import { edgeGeometry, layouts, nodeCenter, noteOffset, type Layout, type Point } from '@/src/core';

// The scene is one flat printed plate: every node and edge stays mounted, and each step only changes which are
// visible and in what state, so CSS transitions carry the diagram from step to step. Flows are small squares that
// travel along an edge; with reduced motion they become one static marker at the edge's midpoint.

type Scene = Lesson['scene'];
const stateWords: Record<string, string> = { active: 'active', ok: 'passing', fail: 'failing', muted: 'out of the loop', idle: '' };

function useCompact(ref: React.RefObject<HTMLElement | null>) {
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => { if (entry) setCompact(entry.contentRect.width < 560); });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return compact;
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(query.matches);
    const update = () => setReduced(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return reduced;
}

export function describeScene(scene: Scene, step: LessonStep) {
  const nodes = new Map(scene.nodes.map(node => [node.id, node]));
  const edges = new Map(scene.edges.map(edge => [edge.id, edge]));
  const shown = step.scene.show.map(id => {
    const state = stateWords[step.scene.states[id] ?? 'idle'];
    const note = step.scene.notes[id];
    return [nodes.get(id)!.label, state && `(${state})`, note && `— ${note}`].filter(Boolean).join(' ');
  });
  const flows = step.scene.flows.map(flow => {
    const edge = edges.get(flow.edge)!;
    return `${nodes.get(edge.from)!.label} to ${nodes.get(edge.to)!.label}${edge.label ? ` (${edge.label})` : ''}`;
  });
  return `${scene.label}. Shown: ${shown.join('; ')}.${flows.length ? ` Moving: ${flows.join('; ')}.` : ''}`;
}

export default function SceneView({ scene, step }: { scene: Scene; step: LessonStep }) {
  const frame = useRef<HTMLDivElement>(null);
  const layout: Layout = useCompact(frame) ? layouts.compact : layouts.wide;
  const reduced = useReducedMotion();
  const position = (id: string): Point => {
    return nodeCenter(scene.nodes.find(n => n.id === id)!, layout);
  };
  const shown = new Set(step.scene.show);
  const flowing = new Map(step.scene.flows.map(flow => [flow.edge, flow.tone]));
  const description = describeScene(scene, step);
  const notes = step.scene.show.filter(id => step.scene.notes[id]);

  return <div className="lesson-scene" ref={frame}>
    <svg viewBox={`0 0 ${layout.w} ${layout.h}`} role="img" aria-label={description} className={layout.compact ? 'is-compact' : undefined}>
      <defs>
        {(['rest', 'signal', 'fail'] as const).map(tone => <marker key={tone} id={`arrow-${tone}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" className={`lesson-scene-arrow tone-${tone}`} /></marker>)}
      </defs>
      {scene.edges.map(edge => {
        const geometry = edgeGeometry(position(edge.from), position(edge.to), edge.bend, layout);
        const visible = shown.has(edge.from) && shown.has(edge.to);
        const tone = flowing.get(edge.id);
        return <g key={edge.id} className={`lesson-scene-edge ${visible ? '' : 'is-hidden'} ${tone ? `is-flowing tone-${tone}` : ''}`} aria-hidden="true">
          <path d={geometry.d} markerEnd={`url(#arrow-${tone ?? 'rest'})`} />
          {edge.label && !layout.compact && <text x={geometry.label.x} y={geometry.label.y} textAnchor={geometry.label.anchor}>{edge.label}</text>}
          {visible && tone && (reduced
            ? <rect className="lesson-scene-packet" x={geometry.mid.x - 6} y={geometry.mid.y - 6} width="12" height="12" />
            : [0, 1, 2].map(i => <rect key={`${step.id}-${i}`} className="lesson-scene-packet" x="-5" y="-5" width="10" height="10" visibility="hidden">
                <set attributeName="visibility" to="visible" begin={`${i * .7}s`} />
                <animateMotion path={geometry.d} dur="2.1s" begin={`${i * .7}s`} repeatCount="indefinite" />
              </rect>))}
        </g>;
      })}
      {scene.nodes.map(node => {
        const p = position(node.id);
        const state = step.scene.states[node.id] ?? 'idle';
        const note = step.scene.notes[node.id];
        const hasSub = layout.sub > 0 && node.sublabel;
        return <g key={node.id} className={`lesson-scene-node state-${state} ${shown.has(node.id) ? '' : 'is-hidden'}`} aria-hidden="true" transform={`translate(${p.x} ${p.y})`}>
          {state === 'active' && <rect className="lesson-scene-ring" x={-layout.nodeW / 2 - 6} y={-layout.nodeH / 2 - 6} width={layout.nodeW + 12} height={layout.nodeH + 12} />}
          <rect className="lesson-scene-box" x={-layout.nodeW / 2} y={-layout.nodeH / 2} width={layout.nodeW} height={layout.nodeH} />
          <text className="lesson-scene-label" y={hasSub ? -3 : layout.label * .36} textAnchor="middle" fontSize={layout.label}>{node.label}</text>
          {hasSub && <text className="lesson-scene-sublabel" y={layout.sub + 6} textAnchor="middle" fontSize={layout.sub}>{node.sublabel}</text>}
          {note && !layout.compact && <text className="lesson-scene-note" y={layout.nodeH / 2 + noteOffset} textAnchor="middle">{note}</text>}
        </g>;
      })}
    </svg>
    {layout.compact && notes.length > 0 && <ul className="lesson-scene-notes">{notes.map(id => <li key={id}><strong>{scene.nodes.find(n => n.id === id)!.label}</strong> {step.scene.notes[id]}</li>)}</ul>}
  </div>;
}
