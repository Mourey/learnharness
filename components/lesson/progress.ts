// Per-viewer lesson progress in localStorage. Storage can be missing or throw (private windows, blocked site data),
// so every access is guarded and the lesson works without it.

export type Confidence = 'guess' | 'fairly' | 'certain';
export interface CheckState { answers: Record<string, string>; confidence: Record<string, Confidence>; submitted: boolean }
export interface Progress { step: string | null; predictions: Record<string, string>; check: CheckState }

export const emptyCheck = (): CheckState => ({ answers: {}, confidence: {}, submitted: false });
const key = (slug: string) => `lh-lesson:${slug}:v1`;
const isRecord = (value: unknown): value is Record<string, string> =>
  !!value && typeof value === 'object' && Object.values(value).every(item => typeof item === 'string');

export function loadProgress(slug: string): Progress | null {
  try {
    const raw = JSON.parse(localStorage.getItem(key(slug)) ?? 'null');
    if (!raw || typeof raw !== 'object') return null;
    const check = raw.check ?? {};
    return {
      step: typeof raw.step === 'string' ? raw.step : null,
      predictions: isRecord(raw.predictions) ? raw.predictions : {},
      check: {
        answers: isRecord(check.answers) ? check.answers : {},
        confidence: isRecord(check.confidence) ? check.confidence as Record<string, Confidence> : {},
        submitted: check.submitted === true,
      },
    };
  } catch {
    return null;
  }
}

export function saveProgress(slug: string, progress: Progress) {
  try { localStorage.setItem(key(slug), JSON.stringify(progress)); } catch {}
}

export function clearProgress(slug: string) {
  try { localStorage.removeItem(key(slug)); } catch {}
}
