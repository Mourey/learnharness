/**
 * SPACED REVIEW, the UI's pure parts (reinforcement, 2026-11-19). Pins: a
 * submitted check goes to the server and the learner hears what was queued;
 * a check in progress in this browser wins over the server's latest, which
 * otherwise comes back submitted; the review page hides the answer until
 * committed, then reveals and says when it returns; and the sidebar badge.
 */

import React from "react";
(globalThis as Record<string, unknown>).React = React;

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { checkSaveMessage, fetchLatestCheck, restoreCheck, submitCheck } from "../components/lesson/check-sync.ts";
import { answerReview, formatDue, ReviewSession, verdictSchedule, type DueReview } from "../components/review-session.tsx";
import { dueBadge } from "../components/review-due.ts";
import type { CheckAttempt } from "../src/core/reviews.ts";

const attempt: CheckAttempt = {
	slug: "loop-engineering",
	at: "2026-11-19T10:00:00.000Z",
	answers: { q1: "b" },
	confidence: { q1: "certain" },
	correct: [],
	scheduled: ["q1"],
};

function fakeFetch(status: number, body: unknown) {
	const calls: { url: string; init?: RequestInit }[] = [];
	const f = (async (url: string, init?: RequestInit) => {
		calls.push({ url, init });
		return new Response(JSON.stringify(body), { status });
	}) as unknown as typeof fetch;
	return { f, calls };
}

describe("the check's server side", () => {
	it("POSTs only answers and confidence, and returns the graded attempt", async () => {
		const { f, calls } = fakeFetch(200, { attempt });
		const got = await submitCheck("loop-engineering", { answers: { q1: "b" }, confidence: { q1: "certain" }, submitted: true }, f);
		assert.deepEqual(got, { attempt, graph: "none", graphCount: 0 }, "an older server without graph fields reads as none");
		assert.equal(calls[0]!.url, "/api/modules/loop-engineering/check");
		assert.equal(calls[0]!.init?.method, "POST");
		assert.deepEqual(JSON.parse(String(calls[0]!.init?.body)), { answers: { q1: "b" }, confidence: { q1: "certain" } });
	});

	it("rejects when the server refuses, and reads a missing latest as null", async () => {
		await assert.rejects(submitCheck("x", { answers: {}, confidence: {}, submitted: true }, fakeFetch(400, {}).f), /400/);
		assert.equal(await fetchLatestCheck("x", fakeFetch(500, {}).f), null);
		assert.deepEqual(await fetchLatestCheck("x", fakeFetch(200, { attempt }).f), attempt);
	});

	it("a check in progress wins; otherwise the server's latest comes back submitted", () => {
		const inProgress = { answers: { q1: "a" }, confidence: {}, submitted: false };
		assert.equal(restoreCheck(inProgress, attempt), inProgress);
		assert.deepEqual(restoreCheck({ answers: {}, confidence: {}, submitted: false }, attempt), { answers: { q1: "b" }, confidence: { q1: "certain" }, submitted: true });
		const empty = { answers: {}, confidence: {}, submitted: false };
		assert.equal(restoreCheck(empty, null), empty);
	});

	it("tells the learner what was queued", () => {
		assert.equal(checkSaveMessage({ status: "idle" }), null);
		assert.equal(checkSaveMessage({ status: "saved", scheduled: 0 }), "Saved. Nothing new for your review queue.");
		assert.equal(checkSaveMessage({ status: "saved", scheduled: 1 }), "Saved. 1 question added to your review queue.");
		assert.equal(checkSaveMessage({ status: "saved", scheduled: 2 }), "Saved. 2 questions added to your review queue.");
		assert.match(checkSaveMessage({ status: "error", message: "the check wasn't saved (500)" })!, /submit again to retry/);
	});
});

const due: DueReview[] = [
	{ slug: "loop-engineering", moduleTitle: "Loop engineering", questionId: "stop-rule", prompt: "What stops the loop?", options: [{ id: "termination", text: "A stopping rule" }, { id: "feedback", text: "More feedback" }], reviewStep: "termination", reviewStepTitle: "Stop on a rule", rung: 0, dueAt: "2026-11-20T10:00:00.000Z" },
];

describe("the review page", () => {
	const now = new Date(2026, 10, 19, 12);

	it("says when something is next due", () => {
		assert.equal(formatDue(new Date(2026, 10, 19, 18).toISOString(), now), "today");
		assert.equal(formatDue(new Date(2026, 10, 20, 9).toISOString(), now), "tomorrow");
		assert.equal(formatDue(new Date(2026, 10, 26, 9).toISOString(), now), "in 7 days");
		assert.match(formatDue(new Date(2027, 0, 8, 9).toISOString(), now), /^on 8 Jan/);
		assert.equal(verdictSchedule({ correct: true, answer: "a", misconception: null, explanation: "", retired: true, nextDueAt: null }, now), "That one has held through every interval. It won't come back.");
		assert.equal(verdictSchedule({ correct: true, answer: "a", misconception: null, explanation: "", retired: false, nextDueAt: new Date(2026, 10, 22, 9).toISOString() }, now), "It comes back in 3 days.");
	});

	it("asks the first due question without revealing anything", () => {
		const html = renderToStaticMarkup(<ReviewSession due={due} nextDueAt={null} />);
		assert.match(html, /What stops the loop\?/);
		assert.match(html, /01<\/span> \/ 01 · Loop engineering/);
		assert.match(html, /Check answer/);
		assert.ok(!html.includes("Correct answer") && !html.includes("Your answer"), "no marks before committing");
	});

	it("an empty queue says when the next review is, or how items get there", () => {
		const soon = renderToStaticMarkup(<ReviewSession due={[]} nextDueAt="2099-01-01T00:00:00.000Z" />);
		assert.match(soon, /Nothing is due\./);
		assert.match(soon, /Your next review is on 1 Jan/);
		const none = renderToStaticMarkup(<ReviewSession due={[]} nextDueAt={null} />);
		assert.match(none, /Take a lesson check in a module/);
	});

	it("posts the answer and confidence to the item's route", async () => {
		const verdict = { correct: false, answer: "termination", misconception: "x", explanation: "y", retired: false, nextDueAt: "2026-11-20T10:00:00.000Z" };
		const { f, calls } = fakeFetch(200, { verdict });
		assert.deepEqual(await answerReview(due[0]!, "feedback", "fairly", f), verdict);
		assert.equal(calls[0]!.url, "/api/reviews/loop-engineering/stop-rule");
		assert.deepEqual(JSON.parse(String(calls[0]!.init?.body)), { answer: "feedback", confidence: "fairly" });
		await assert.rejects(answerReview(due[0]!, "feedback", "fairly", fakeFetch(404, {}).f), /404/);
	});
});

describe("the sidebar badge", () => {
	it("shows a count only when something is due", () => {
		assert.equal(dueBadge(null), null);
		assert.equal(dueBadge(0), null);
		assert.equal(dueBadge(3), "3");
		assert.equal(dueBadge(150), "99+");
	});
});
