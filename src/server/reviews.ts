import {
	applyCheck,
	applyReview,
	checkSubmissionProblem,
	CONFIDENCES,
	dueItems,
	latestAttempt,
	nextDueAt,
	reviewKey,
	type CheckAttempt,
	type CheckQuestion,
	type CheckSubmission,
	type Confidence,
	type Lesson,
} from "../core/index.ts";
import { readReviews, writeReviews } from "../store/reviews.ts";
import { readModuleLesson, readModuleManifest } from "./modules.ts";

/**
 * Spaced review, server side (reinforcement, 2026-11-19): joins the review
 * record (data/reviews.json) with the module lessons it points at. Routes
 * call these; every grade is computed here from the lesson on disk.
 */

/** A due question as the review page asks it: no answer, explanation or misconceptions until answered. */
export interface DueReview {
	slug: string;
	moduleTitle: string;
	questionId: string;
	prompt: string;
	options: { id: string; text: string }[];
	reviewStep: string;
	reviewStepTitle: string;
	rung: number;
	dueAt: string;
}

export interface ReviewQueue {
	due: DueReview[];
	nextDueAt: string | null;
}

/** What answering a review reveals. */
export interface ReviewVerdict {
	correct: boolean;
	answer: string;
	misconception: string | null;
	explanation: string;
	retired: boolean;
	nextDueAt: string | null;
}

export type Result<T> = { ok: true; value: T } | { ok: false; status: 400 | 404; error: string };

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const stringMap = (v: unknown): Record<string, string> | null =>
	isObject(v) && Object.values(v).every((x) => typeof x === "string") ? (v as Record<string, string>) : null;
const isConfidence = (v: unknown): v is Confidence => CONFIDENCES.includes(v as Confidence);

function lessonFor(slug: string): Lesson | null {
	return readModuleManifest(slug) ? readModuleLesson(slug) : null;
}

/** Grade and save a lesson check; the attempt says which questions were scheduled. */
export function submitCheck(slug: string, body: unknown, now = new Date()): Result<CheckAttempt> {
	const lesson = lessonFor(slug);
	if (!lesson) return { ok: false, status: 404, error: "no lesson for this module" };
	const answers = isObject(body) ? stringMap(body.answers) : null;
	const confidence = isObject(body) ? stringMap(body.confidence) : null;
	if (!answers || !confidence) return { ok: false, status: 400, error: "answers and confidence must be maps of question id to string" };
	const submission = { answers, confidence } as CheckSubmission;
	const problem = checkSubmissionProblem(lesson, submission);
	if (problem) return { ok: false, status: 400, error: problem };
	const { record, attempt } = applyCheck(readReviews(), slug, lesson, submission, now);
	writeReviews(record);
	return { ok: true, value: attempt };
}

export function latestCheck(slug: string): CheckAttempt | null {
	return latestAttempt(readReviews(), slug);
}

function findQuestion(lesson: Lesson, questionId: string): CheckQuestion | null {
	return lesson.check.find((q) => q.id === questionId) ?? null;
}

/** Due questions whose module and question still exist, oldest first. */
export function reviewQueue(now = new Date()): ReviewQueue {
	const record = readReviews();
	const lessons = new Map<string, Lesson | null>();
	const due: DueReview[] = [];
	for (const item of dueItems(record, now)) {
		if (!lessons.has(item.slug)) lessons.set(item.slug, lessonFor(item.slug));
		const lesson = lessons.get(item.slug);
		const question = lesson && findQuestion(lesson, item.questionId);
		if (!lesson || !question) continue;
		due.push({
			slug: item.slug,
			moduleTitle: readModuleManifest(item.slug)?.title ?? item.slug,
			questionId: item.questionId,
			prompt: question.prompt,
			options: question.options.map((o) => ({ id: o.id, text: o.text })),
			reviewStep: question.reviewStep,
			reviewStepTitle: lesson.steps.find((s) => s.id === question.reviewStep)?.title ?? question.reviewStep,
			rung: item.rung,
			dueAt: item.dueAt,
		});
	}
	return { due, nextDueAt: nextDueAt(record, now) };
}

/** Grade one review answer, move the item on the ladder, and reveal. */
export function answerReview(slug: string, questionId: string, body: unknown, now = new Date()): Result<ReviewVerdict> {
	const record = readReviews();
	const key = reviewKey(slug, questionId);
	const item = record.items[key];
	const lesson = lessonFor(slug);
	const question = lesson && findQuestion(lesson, questionId);
	if (!item || item.retiredAt || !question) return { ok: false, status: 404, error: "no such review item" };
	const answer = isObject(body) && typeof body.answer === "string" ? body.answer : null;
	const confidence = isObject(body) ? body.confidence : null;
	if (!answer || !question.options.some((o) => o.id === answer)) return { ok: false, status: 400, error: "answer must be one of the question's options" };
	if (!isConfidence(confidence)) return { ok: false, status: 400, error: "confidence must be guess, fairly or certain" };
	const next = applyReview(item, question, answer, confidence, now);
	writeReviews({ ...record, items: { ...record.items, [key]: next } });
	const correct = answer === question.answer;
	return {
		ok: true,
		value: {
			correct,
			answer: question.answer,
			misconception: correct ? null : (question.options.find((o) => o.id === answer)?.misconception ?? null),
			explanation: question.explanation,
			retired: !!next.retiredAt,
			nextDueAt: next.retiredAt ? null : next.dueAt,
		},
	};
}
