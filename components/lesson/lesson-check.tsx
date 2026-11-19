"use client";

import Link from 'next/link';
import type { CheckQuestion, LessonStep } from '@/src/core';
import type { CheckState, Confidence } from './progress';
import Question from './question';
import { checkSaveMessage, type CheckSave } from './check-sync';

// The end-of-lesson check. Each answer carries a confidence rating, because a confident wrong answer is a held
// misconception and a lucky guess is not yet understanding; both point back to the step worth reviewing.

const confidences: { id: Confidence; label: string }[] = [
  { id: 'guess', label: 'Guessing' },
  { id: 'fairly', label: 'Fairly sure' },
  { id: 'certain', label: 'Certain' },
];

interface Props { questions: CheckQuestion[]; steps: LessonStep[]; state: CheckState; save?: CheckSave; onChange: (state: CheckState) => void; onReview: (stepId: string) => void }

export default function LessonCheck({ questions, steps, state, save = { status: 'idle' }, onChange, onReview }: Props) {
  const saveMessage = checkSaveMessage(save);
  const ready = questions.every(q => state.answers[q.id] && state.confidence[q.id]);
  const score = questions.filter(q => state.answers[q.id] === q.answer).length;
  const stepTitle = (id: string) => steps.find(step => step.id === id)?.short ?? id;

  return <section className="lesson-check" id="check" aria-labelledby="check-title">
    <header>
      <h2 id="check-title">Check your understanding</h2>
      <p>{questions.length} questions. Answer each one, then say how sure you are. Your confidence matters as much as the answer.</p>
    </header>
    <ol>
      {questions.map((q, index) => {
        const answered = state.answers[q.id];
        const confidence = state.confidence[q.id];
        const correct = answered === q.answer;
        const flag = !state.submitted ? null
          : !correct && confidence === 'certain' ? 'You were certain and wrong. This is the one to revisit.'
          : correct && confidence === 'guess' ? 'Right, but you were guessing. Worth a second look.'
          : !correct ? 'Review the step this question comes from.' : null;
        return <li key={q.id} className="lesson-check-item">
          <span className="lesson-check-number">{index + 1}</span>
          <div>
            <Question question={q} selected={answered} committed={state.submitted} headingLevel="h3"
              onSelect={option => onChange({ ...state, answers: { ...state.answers, [q.id]: option } })} />
            <div className="lesson-confidence" role="radiogroup" aria-label={`How sure are you about question ${index + 1}?`}>
              {confidences.map(item => <button key={item.id} type="button" role="radio" aria-checked={confidence === item.id} disabled={state.submitted}
                onClick={() => onChange({ ...state, confidence: { ...state.confidence, [q.id]: item.id } })}>{item.label}</button>)}
            </div>
            {flag && <p className="lesson-check-flag">{flag} <button type="button" className="lesson-link" onClick={() => onReview(q.reviewStep)}>Review “{stepTitle(q.reviewStep)}”</button></p>}
          </div>
        </li>;
      })}
    </ol>
    <footer>
      {state.submitted
        ? <><p className="lesson-check-score" role="status"><strong>{score} of {questions.length}</strong> correct.</p>
            <button type="button" className="lesson-action" onClick={() => onChange({ answers: {}, confidence: {}, submitted: false })}>Try again</button></>
        : <><button type="button" className="lesson-action" disabled={!ready} onClick={() => onChange({ ...state, submitted: true })}>Submit answers</button>
            {!ready && <p className="lesson-hint">Answer every question and rate your confidence to submit.</p>}</>}
      {saveMessage && <p className={`lesson-check-save${save.status === 'error' ? ' is-error' : ''}`} role="status" data-testid="check-save">
        {saveMessage}{save.status === 'saved' && save.scheduled > 0 && <> <Link className="lesson-link" href="/review">Open review</Link></>}
      </p>}
    </footer>
  </section>;
}
