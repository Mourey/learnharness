"use client";

import { useCallback, useEffect, useRef, useState } from 'react';

// Narration reads the current step aloud with the browser's speech synthesis, then advances. It stops at a step whose
// prediction is still open, and at the last step. Without speech synthesis it falls back to timed autoplay, so play
// still walks the lesson. Text is spoken sentence by sentence because Chromium drops long single utterances.

export type NarrationMode = 'speech' | 'timer';

interface Options { stepKey: string; text: string; canAdvance: boolean; isLast: boolean; onAdvance: () => void }

const sentences = (text: string) => text.match(/[^.!?]+[.!?]*\s*/g)?.map(s => s.trim()).filter(Boolean) ?? [text];

function pickVoice() {
  const voices = speechSynthesis.getVoices().filter(voice => voice.lang.startsWith('en'));
  return voices.find(voice => voice.localService && /en-GB/.test(voice.lang)) ?? voices.find(voice => voice.localService) ?? voices[0];
}

export function useNarration({ stepKey, text, canAdvance, isLast, onAdvance }: Options) {
  const [playing, setPlaying] = useState(false);
  const [mode, setMode] = useState<NarrationMode>('speech');
  const latest = useRef({ canAdvance, isLast, onAdvance });
  latest.current = { canAdvance, isLast, onAdvance };

  useEffect(() => { setMode(typeof window !== 'undefined' && 'speechSynthesis' in window ? 'speech' : 'timer'); }, []);

  useEffect(() => {
    if (!playing) return;
    let alive = true;
    const finished = () => {
      if (!alive) return;
      const { canAdvance, isLast, onAdvance } = latest.current;
      if (canAdvance && !isLast) onAdvance();
      else setPlaying(false);
    };
    if (mode === 'timer') {
      const words = text.split(/\s+/).length;
      const timer = window.setTimeout(finished, Math.max(4000, words / 2.6 * 1000));
      return () => { alive = false; window.clearTimeout(timer); };
    }
    speechSynthesis.cancel();
    const parts = sentences(text);
    const voice = pickVoice();
    parts.forEach((part, index) => {
      const utterance = new SpeechSynthesisUtterance(part);
      if (voice) utterance.voice = voice;
      utterance.rate = 1;
      if (index === parts.length - 1) utterance.onend = finished;
      utterance.onerror = event => { if (alive && event.error !== 'interrupted' && event.error !== 'canceled') { setMode('timer'); } };
      speechSynthesis.speak(utterance);
    });
    return () => { alive = false; speechSynthesis.cancel(); };
  }, [playing, stepKey, mode]); // text is derived from stepKey

  useEffect(() => () => { if (typeof window !== 'undefined' && 'speechSynthesis' in window) speechSynthesis.cancel(); }, []);

  const toggle = useCallback(() => setPlaying(value => !value), []);
  const stop = useCallback(() => setPlaying(false), []);
  return { playing, mode, toggle, stop };
}
