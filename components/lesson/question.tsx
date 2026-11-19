"use client";

import { useId } from 'react';
import type { LessonQuestion } from '@/src/core';
import Inline from './inline';

// A question with native radio inputs. Once `committed` is set, the options lock and each is marked: the correct
// answer, the chosen wrong answer, and the misconception that wrong answer reveals.

interface Props { question: LessonQuestion; selected: string | undefined; committed: boolean; onSelect: (option: string) => void; headingLevel?: 'h3' | 'h4' }

export default function Question({ question, selected, committed, onSelect, headingLevel: Heading = 'h3' }: Props) {
  const name = useId();
  const chosen = question.options.find(option => option.id === selected);
  const correct = selected === question.answer;
  return <fieldset className="lesson-question" disabled={committed}>
    <legend><Heading className="lesson-question-prompt"><Inline text={question.prompt} /></Heading></legend>
    <div className="lesson-options">
      {question.options.map(option => {
        const verdict = !committed ? '' : option.id === question.answer ? 'is-answer' : option.id === selected ? 'is-wrong' : 'is-other';
        return <label key={option.id} className={`lesson-option ${verdict}`}>
          <input type="radio" name={name} value={option.id} checked={selected === option.id} onChange={() => onSelect(option.id)} />
          <span><Inline text={option.text} /></span>
          {committed && option.id === question.answer && <span className="lesson-option-mark">Correct answer</span>}
          {committed && option.id === selected && option.id !== question.answer && <span className="lesson-option-mark">Your answer</span>}
        </label>;
      })}
    </div>
    {committed && <div className={`lesson-reveal ${correct ? 'is-correct' : 'is-incorrect'}`} role="status">
      <p className="lesson-reveal-verdict">{correct ? 'Right.' : 'Not quite.'}</p>
      {!correct && chosen?.misconception && <p><Inline text={chosen.misconception} /></p>}
      <p><Inline text={question.explanation} /></p>
    </div>}
  </fieldset>;
}
