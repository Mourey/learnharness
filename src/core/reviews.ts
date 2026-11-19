import type { CheckQuestion, Lesson } from "./lesson-schema.ts";

/**
 * SPACED REVIEW (reinforcement, 2026-11-19): the lesson check's confident
 * misses and lucky guesses come back on a fixed ladder until they hold.
 *
 * This file is the pure half: the record shape, which answers qualify, the
 * ladder, and how a check submission or a review answer moves an item.
 * src/store/reviews.ts persists the record (data/reviews.json);
 * src/server/reviews.ts joins it with the module lessons.
 *
 * Grading always happens here, against the lesson's own answers: the
 * client's sense of right and wrong is never trusted.
 */

export const CONFIDENCES = ["guess", "fairly", "certain"] as const;
export type Confidence = (typeof CONFIDENCES)[number];

/** Days until the next review, by rung. Passing the last rung retires the item. */
export const LADDER_DAYS = [1, 3, 7, 21, 60] as const;

const DAY_MS = 86_400_000;

export const CURRENT_REVIEWS_VERSION = 1;

/** One graded answer, from a check or a review. */
export interface ReviewAnswer {
	at: string;
	source: "check" | "review";
	answer: string;
	confidence: Confidence;
	correct: boolean;
}

export interface ReviewItem {
	slug: string;
	questionId: string;
	/** Index into LADDER_DAYS of the interval that produced dueAt. */
	rung: number;
	dueAt: string;
	addedAt: string;
	/** Set when the last rung was passed; a retired item is never due. */
	retiredAt?: string;
	history: ReviewAnswer[];
}

/** One submitted lesson check, as graded. */
export interface CheckAttempt {
	slug: string;
	at: string;
	answers: Record<string, string>;
	confidence: Record<string, Confidence>;
	correct: string[];
	/** Question ids this submission added to (or reset in) the review queue. */
	scheduled: string[];
}

export interface ReviewsRecord {
	version: number;
	attempts: CheckAttempt[];
	items: Record<string, ReviewItem>;
}

export const emptyReviews = (): ReviewsRecord => ({ version: CURRENT_REVIEWS_VERSION, attempts: [], items: {} });

export const reviewKey = (slug: string, questionId: string) => `${slug}/${questionId}`;

/** A confident miss (wrong while fairly sure or certain) or a lucky guess (right while guessing). */
export function qualifies(correct: boolean, confidence: Confidence): boolean {
	return correct ? confidence === "guess" : confidence !== "guess";
}

const addDays = (now: Date, days: number) => new Date(now.getTime() + days * DAY_MS).toISOString();

export interface CheckSubmission {
	answers: Record<string, string>;
	confidence: Record<string, Confidence>;
}

/** Why a submission can't be graded, or null when every question has an answer and a confidence. */
export function checkSubmissionProblem(lesson: Pick<Lesson, "check">, submission: CheckSubmission): string | null {
	for (const q of lesson.check) {
		const answer = submission.answers[q.id];
		if (!answer) return `question "${q.id}" has no answer`;
		if (!q.options.some((o) => o.id === answer)) return `question "${q.id}" has no option "${answer}"`;
		if (!CONFIDENCES.includes(submission.confidence[q.id] as Confidence)) return `question "${q.id}" has no confidence`;
	}
	return null;
}

/**
 * Grade a check and fold it into the record. Qualifying answers enter the
 * queue at rung 0, due in a day; an item already queued resets to rung 0
 * when answered wrong with confidence. A check never moves an item UP: a
 * retake right after the reveal is recognition, not recall.
 */
export function applyCheck(record: ReviewsRecord, slug: string, lesson: Pick<Lesson, "check">, submission: CheckSubmission, now: Date): { record: ReviewsRecord; attempt: CheckAttempt } {
	const at = now.toISOString();
	const items = { ...record.items };
	const correct: string[] = [];
	const scheduled: string[] = [];
	for (const q of lesson.check) {
		const answer = submission.answers[q.id]!;
		const confidence = submission.confidence[q.id]!;
		const right = answer === q.answer;
		if (right) correct.push(q.id);
		const key = reviewKey(slug, q.id);
		const existing = items[key];
		const entry: ReviewAnswer = { at, source: "check", answer, confidence, correct: right };
		if (existing && !existing.retiredAt) {
			const reset = !right && confidence !== "guess";
			items[key] = { ...existing, history: [...existing.history, entry], ...(reset ? { rung: 0, dueAt: addDays(now, LADDER_DAYS[0]) } : {}) };
			if (reset) scheduled.push(q.id);
		} else if (qualifies(right, confidence)) {
			items[key] = { slug, questionId: q.id, rung: 0, dueAt: addDays(now, LADDER_DAYS[0]), addedAt: at, history: [...(existing?.history ?? []), entry] };
			scheduled.push(q.id);
		}
	}
	const attempt: CheckAttempt = { slug, at, answers: { ...submission.answers }, confidence: { ...submission.confidence }, correct, scheduled };
	return { record: { ...record, attempts: [...record.attempts, attempt], items }, attempt };
}

/**
 * The ladder: right while fairly sure or certain climbs a rung (past the
 * last, the item retires); right while guessing repeats the rung; wrong
 * starts again at rung 0.
 */
export function applyReview(item: ReviewItem, question: Pick<CheckQuestion, "answer">, answer: string, confidence: Confidence, now: Date): ReviewItem {
	const correct = answer === question.answer;
	const at = now.toISOString();
	const history = [...item.history, { at, source: "review" as const, answer, confidence, correct }];
	if (!correct) return { ...item, rung: 0, dueAt: addDays(now, LADDER_DAYS[0]), history };
	if (confidence === "guess") return { ...item, dueAt: addDays(now, LADDER_DAYS[item.rung] ?? LADDER_DAYS[0]), history };
	const rung = item.rung + 1;
	if (rung >= LADDER_DAYS.length) return { ...item, retiredAt: at, history };
	return { ...item, rung, dueAt: addDays(now, LADDER_DAYS[rung]!), history };
}

export function isDue(item: ReviewItem, now: Date): boolean {
	return !item.retiredAt && new Date(item.dueAt).getTime() <= now.getTime();
}

/** Due items, oldest due first. */
export function dueItems(record: ReviewsRecord, now: Date): ReviewItem[] {
	return Object.values(record.items)
		.filter((item) => isDue(item, now))
		.sort((a, b) => a.dueAt.localeCompare(b.dueAt));
}

/** The soonest dueAt among active items that aren't due yet, or null. */
export function nextDueAt(record: ReviewsRecord, now: Date): string | null {
	const upcoming = Object.values(record.items)
		.filter((item) => !item.retiredAt && !isDue(item, now))
		.map((item) => item.dueAt)
		.sort();
	return upcoming[0] ?? null;
}

/** The latest check attempt for a module, or null. */
export function latestAttempt(record: ReviewsRecord, slug: string): CheckAttempt | null {
	for (let i = record.attempts.length - 1; i >= 0; i--) if (record.attempts[i]!.slug === slug) return record.attempts[i]!;
	return null;
}

// ── reading the file defensively ────────────────────────────────────────────

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const isString = (v: unknown): v is string => typeof v === "string";
const isConfidence = (v: unknown): v is Confidence => CONFIDENCES.includes(v as Confidence);
const isIso = (v: unknown): v is string => isString(v) && !Number.isNaN(Date.parse(v));
const stringMap = (v: unknown): Record<string, string> | null =>
	isObject(v) && Object.values(v).every(isString) ? (v as Record<string, string>) : null;

function sanitizeAnswer(v: unknown): ReviewAnswer | null {
	if (!isObject(v) || !isIso(v.at) || (v.source !== "check" && v.source !== "review") || !isString(v.answer) || !isConfidence(v.confidence) || typeof v.correct !== "boolean") return null;
	return { at: v.at, source: v.source, answer: v.answer, confidence: v.confidence, correct: v.correct };
}

function sanitizeItem(v: unknown): ReviewItem | null {
	if (!isObject(v) || !isString(v.slug) || !isString(v.questionId) || !isIso(v.dueAt) || !isIso(v.addedAt)) return null;
	if (!Number.isInteger(v.rung) || (v.rung as number) < 0 || (v.rung as number) >= LADDER_DAYS.length) return null;
	const history = Array.isArray(v.history) ? v.history.map(sanitizeAnswer).filter((a): a is ReviewAnswer => a !== null) : [];
	return { slug: v.slug, questionId: v.questionId, rung: v.rung as number, dueAt: v.dueAt, addedAt: v.addedAt, ...(isIso(v.retiredAt) ? { retiredAt: v.retiredAt } : {}), history };
}

function sanitizeAttempt(v: unknown): CheckAttempt | null {
	if (!isObject(v) || !isString(v.slug) || !isIso(v.at)) return null;
	const answers = stringMap(v.answers);
	const confidence = stringMap(v.confidence);
	if (!answers || !confidence || !Object.values(confidence).every(isConfidence)) return null;
	const ids = (x: unknown) => (Array.isArray(x) ? x.filter(isString) : []);
	return { slug: v.slug, at: v.at, answers, confidence: confidence as Record<string, Confidence>, correct: ids(v.correct), scheduled: ids(v.scheduled) };
}

/** The record from parsed JSON, dropping malformed entries; null when it isn't a record at all. */
export function sanitizeReviews(raw: unknown): ReviewsRecord | null {
	if (!isObject(raw)) return null;
	const items: Record<string, ReviewItem> = {};
	if (isObject(raw.items)) {
		for (const value of Object.values(raw.items)) {
			const item = sanitizeItem(value);
			if (item) items[reviewKey(item.slug, item.questionId)] = item;
		}
	}
	const attempts = Array.isArray(raw.attempts) ? raw.attempts.map(sanitizeAttempt).filter((a): a is CheckAttempt => a !== null) : [];
	return { version: typeof raw.version === "number" ? raw.version : CURRENT_REVIEWS_VERSION, attempts, items };
}
