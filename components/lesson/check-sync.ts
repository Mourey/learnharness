import type { CheckAttempt } from '@/src/core';
import type { CheckState } from './progress';

// The lesson check's server side (reinforcement, 2026-11-19). A submitted check is graded and saved by
// POST /api/modules/<slug>/check, which also queues confident misses and lucky guesses for spaced review. The
// browser's copy stays a convenience: a check in progress lives in localStorage, a submitted one comes back from
// the server. Fetch is injected so tests can pin the calls.

export type CheckSave = { status: 'idle' } | { status: 'saving' } | { status: 'saved'; scheduled: number } | { status: 'error'; message: string };

export async function submitCheck(slug: string, state: CheckState, fetchLike: typeof fetch): Promise<CheckAttempt> {
  const res = await fetchLike(`/api/modules/${encodeURIComponent(slug)}/check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answers: state.answers, confidence: state.confidence }),
  });
  if (!res.ok) throw new Error(`the check wasn't saved (${res.status})`);
  return ((await res.json()) as { attempt: CheckAttempt }).attempt;
}

export async function fetchLatestCheck(slug: string, fetchLike: typeof fetch): Promise<CheckAttempt | null> {
  const res = await fetchLike(`/api/modules/${encodeURIComponent(slug)}/check`);
  if (!res.ok) return null;
  return ((await res.json()) as { attempt: CheckAttempt | null }).attempt;
}

/** A check in progress in this browser wins; otherwise the server's latest submission, shown as submitted. */
export function restoreCheck(local: CheckState, attempt: CheckAttempt | null): CheckState {
  if (Object.keys(local.answers).length > 0 && !local.submitted) return local;
  if (!attempt) return local;
  return { answers: { ...attempt.answers }, confidence: { ...attempt.confidence }, submitted: true };
}

/** The footer line after saving. */
export function checkSaveMessage(save: CheckSave): string | null {
  if (save.status === 'saving') return 'Saving…';
  if (save.status === 'error') return `${save.message}. Your answers are still here; submit again to retry.`;
  if (save.status !== 'saved') return null;
  if (save.scheduled === 0) return 'Saved. Nothing new for your review queue.';
  return `Saved. ${save.scheduled} ${save.scheduled === 1 ? 'question' : 'questions'} added to your review queue.`;
}
