"use client";

import { useCallback, useEffect, useState } from 'react';
import type { Lesson, LessonStep } from '@/src/core';
import { plainText } from '@/src/core';
import Inline from './inline';
import SceneView from './scene';
import Question from './question';
import LessonCheck from './lesson-check';
import { useNarration } from './use-narration';
import { clearProgress, emptyCheck, loadProgress, saveProgress, type CheckState } from './progress';

type Props = Pick<Lesson, 'scene' | 'metrics' | 'steps' | 'check'> & { slug: string };

const chapterNames: Record<LessonStep['chapter'], string> = {
  setup: 'Setup', problem: 'Problem', technique: 'Technique', solution: 'Solution', tradeoff: 'Trade-off', insight: 'Insight', recap: 'Recap',
};

function narrationText(step: LessonStep) {
  return [step.title, ...step.body, step.callout?.text, step.predict && `Question: ${step.predict.prompt}`]
    .filter((part): part is string => !!part).map(part => plainText(part).replace(/([^.!?:])$/, '$1.')).join(' ');
}

function formatMetric(value: number | string | undefined, unit: string) {
  if (value === undefined) return '—';
  if (typeof value === 'string') return value;
  if (unit === 'k' && value >= 1000) return `${(value / 1000).toFixed(1).replace(/\.0$/, '')}M`;
  return `${value.toLocaleString('en-GB')}${unit === 'k' ? 'k' : ''}`;
}

export default function LessonPlayer({ slug, scene, metrics, steps, check }: Props) {
  const [index, setIndex] = useState(0);
  const [predictions, setPredictions] = useState<Record<string, string>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [checkState, setCheckState] = useState<CheckState>(emptyCheck);
  const [loaded, setLoaded] = useState(false);

  // The schema guarantees at least two steps and go() clamps index, so the step always exists.
  const step = steps[index]!;
  const previous = steps[index - 1];
  const isLast = index === steps.length - 1;
  const gated = !!step.predict && !predictions[step.id];

  useEffect(() => {
    const saved = loadProgress(slug);
    const fromHash = steps.findIndex(s => s.id === decodeURIComponent(location.hash.slice(1)));
    const fromSaved = steps.findIndex(s => s.id === saved?.step);
    if (saved) { setPredictions(saved.predictions); setCheckState(saved.check); }
    if (fromHash >= 0) setIndex(fromHash);
    else if (fromSaved >= 0) setIndex(fromSaved);
    setLoaded(true);
  }, [slug, steps]);

  useEffect(() => {
    if (!loaded) return;
    saveProgress(slug, { step: step.id, predictions, check: checkState });
    if (location.hash !== '#check') history.replaceState(null, '', `#${step.id}`);
  }, [loaded, slug, step.id, predictions, checkState]);

  const go = useCallback((next: number) => {
    setIndex(Math.max(0, Math.min(steps.length - 1, next)));
  }, [steps.length]);

  const narration = useNarration({ stepKey: step.id, text: narrationText(step), canAdvance: !gated, isLast, onAdvance: () => go(index + 1) });

  const toCheck = () => { narration.stop(); history.replaceState(null, '', '#check'); document.getElementById('check')?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); };
  const next = () => { if (gated) return; if (isLast) toCheck(); else go(index + 1); };
  const review = (stepId: string) => {
    narration.stop();
    go(steps.findIndex(s => s.id === stepId));
    document.getElementById('lesson-player')?.scrollIntoView({ block: 'start' });
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      const target = event.target as HTMLElement;
      if (target.closest('input, textarea, select, [role="radio"], [contenteditable="true"]')) return;
      if (event.key === 'ArrowRight' && !gated && !isLast) { event.preventDefault(); go(index + 1); }
      if (event.key === 'ArrowLeft' && index > 0) { event.preventDefault(); go(index - 1); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [index, gated, isLast, go]);

  return <>
    <section className="lesson-player" id="lesson-player" aria-label="Lesson" data-ready={loaded ? '' : undefined}>
      <div className="lesson-band">
      <div className="lesson-stage">
        <SceneView scene={scene} step={step} />
        {metrics.length > 0 && <dl className="lesson-metrics">
          {metrics.map(metric => {
            const value = step.metrics[metric.id];
            const before = previous?.metrics[metric.id];
            const delta = typeof value === 'number' && typeof before === 'number' && value !== before
              ? ((value < before) === (metric.better === 'lower') ? 'better' : 'worse')
              : typeof value === 'string' && before !== undefined && value !== before ? 'changed' : null;
            return <div key={metric.id} className={delta ? `is-${delta}` : undefined}>
              <dt>{metric.label}</dt>
              <dd>{formatMetric(value, metric.unit)}{metric.unit && metric.unit !== 'k' && typeof value === 'number' && <small> {metric.unit}</small>}
                {delta && <span className="lesson-delta">{delta}</span>}</dd>
            </div>;
          })}
        </dl>}
        {step.changes.length > 0 && <ul className="lesson-changes" aria-label="What changed">
          {step.changes.map(change => <li key={change} className={`change-${({ '+': 'add', '~': 'shift', '-': 'remove' } as Record<string, string>)[change.charAt(0)]}`}><span aria-hidden="true">{change[0]}</span>{change.slice(2)}</li>)}
        </ul>}
      </div>

      <article className="lesson-panel">
        <p className="sr-only" aria-live="polite">{loaded ? `Step ${index + 1} of ${steps.length}: ${step.title}` : ''}</p>
        <p className="lesson-position"><span>{index + 1} / {steps.length}</span> {chapterNames[step.chapter]}</p>
        <h2>{step.title}</h2>
        {step.body.map(paragraph => <p key={paragraph}><Inline text={paragraph} /></p>)}
        {step.callout && <aside className={`lesson-callout is-${step.callout.kind}`}><span className="sr-only">{step.callout.kind === 'tip' ? 'Tip: ' : 'Warning: '}</span><Inline text={step.callout.text} /></aside>}
        {step.predict && <div className="lesson-predict">
          <p className="lesson-predict-label">Predict</p>
          <Question question={step.predict} selected={predictions[step.id] ?? drafts[step.id]} committed={!!predictions[step.id]}
            onSelect={option => setDrafts(d => ({ ...d, [step.id]: option }))} />
          {!predictions[step.id] && <button type="button" className="lesson-action" disabled={!drafts[step.id]}
            onClick={() => { const draft = drafts[step.id]; if (draft) setPredictions(p => ({ ...p, [step.id]: draft })); }}>Commit answer</button>}
        </div>}
        <div className="lesson-controls">
          <button type="button" className="lesson-nav" onClick={() => go(index - 1)} disabled={index === 0}><span aria-hidden="true">←</span> Back</button>
          <button type="button" className="lesson-play" onClick={narration.toggle} aria-pressed={narration.playing}
            title={narration.mode === 'timer' ? 'Speech is not available in this browser; play advances on a timer.' : undefined}>
            {narration.playing ? 'Pause' : narration.mode === 'speech' ? 'Narrate' : 'Autoplay'}
          </button>
          <button type="button" className="lesson-nav is-next" onClick={next} disabled={gated}>{isLast ? 'Check your understanding' : 'Next'} <span aria-hidden="true">→</span></button>
        </div>
        {gated && <p className="lesson-hint">Commit an answer to continue.</p>}
      </article>
      </div>

      <nav className="lesson-rail" aria-label="Lesson steps">
        <ol>
          {steps.map((s, i) => {
            const locked = steps.slice(0, i).some(prior => prior.predict && !predictions[prior.id]);
            return <li key={s.id}><button type="button" onClick={() => go(i)} disabled={locked} aria-current={i === index ? 'step' : undefined}>
              <span>{String(i + 1).padStart(2, '0')}</span>{s.short}
            </button></li>;
          })}
        </ol>
        <button type="button" className="lesson-link lesson-restart" onClick={() => { narration.stop(); clearProgress(slug); setPredictions({}); setDrafts({}); setCheckState(emptyCheck()); go(0); }}>Start over</button>
      </nav>
    </section>

    <LessonCheck questions={check} steps={steps} state={checkState} onChange={setCheckState} onReview={review} />
  </>;
}
