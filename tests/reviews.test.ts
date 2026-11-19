/**
 * SPACED REVIEW (reinforcement, 2026-11-19): lesson-check confident misses
 * and lucky guesses return on a fixed ladder, saved in data/reviews.json.
 * Pins: which answers qualify; the ladder (climb, repeat on a guess, reset
 * on a miss, retire past the last rung); a check never advances an item;
 * grading uses the lesson on disk, never the client; the file survives
 * corruption and is written atomically; and the routes grade, schedule,
 * hide answers until answered, and refuse bad input.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { after, describe, it } from "node:test";

// ── the seams, BEFORE any config-loading import ─────────────────────────────
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "lh-reviews-"));
process.env.LH_DATA_DIR = TMP;
process.env.LH_MODULES_DIR = path.join(process.cwd(), "modules");

const core = await import("../src/core/reviews.ts");
const { readReviews, writeReviews } = await import("../src/store/reviews.ts");
const server = await import("../src/server/reviews.ts");
const checkRoute = await import("../app/api/modules/[slug]/check/route.ts");
const queueRoute = await import("../app/api/reviews/route.ts");
const answerRoute = await import("../app/api/reviews/[slug]/[questionId]/route.ts");
const { REVIEWS_FILE } = await import("../config.ts");

after(() => {
	fs.rmSync(TMP, { recursive: true, force: true });
	delete process.env.LH_MODULES_DIR;
});

const DAY = 86_400_000;
const T0 = new Date("2026-11-19T10:00:00.000Z");
const at = (days: number) => new Date(T0.getTime() + days * DAY);

const LESSON = {
	check: [
		{ id: "q1", answer: "a", options: [{ id: "a", text: "A" }, { id: "b", text: "B", misconception: "B is tempting" }], prompt: "Q1?", explanation: "Because A.", reviewStep: "s1" },
		{ id: "q2", answer: "a", options: [{ id: "a", text: "A" }, { id: "b", text: "B" }], prompt: "Q2?", explanation: "Because A.", reviewStep: "s1" },
		{ id: "q3", answer: "a", options: [{ id: "a", text: "A" }, { id: "b", text: "B" }], prompt: "Q3?", explanation: "Because A.", reviewStep: "s1" },
		{ id: "q4", answer: "a", options: [{ id: "a", text: "A" }, { id: "b", text: "B" }], prompt: "Q4?", explanation: "Because A.", reviewStep: "s1" },
	],
};

describe("what qualifies", () => {
	it("confident misses and lucky guesses, nothing else", () => {
		assert.equal(core.qualifies(false, "certain"), true);
		assert.equal(core.qualifies(false, "fairly"), true);
		assert.equal(core.qualifies(true, "guess"), true);
		assert.equal(core.qualifies(false, "guess"), false, "a wrong guess is already known to be shaky");
		assert.equal(core.qualifies(true, "fairly"), false);
		assert.equal(core.qualifies(true, "certain"), false);
	});
});

describe("applyCheck", () => {
	const submission = {
		answers: { q1: "b", q2: "b", q3: "a", q4: "b" },
		confidence: { q1: "certain", q2: "fairly", q3: "guess", q4: "guess" },
	} as const;

	it("grades against the lesson and queues qualifying answers at rung 0, due in a day", () => {
		const { record, attempt } = core.applyCheck(core.emptyReviews(), "m", LESSON, submission, T0);
		assert.deepEqual(attempt.correct, ["q3"]);
		assert.deepEqual(attempt.scheduled, ["q1", "q2", "q3"]);
		assert.deepEqual(Object.keys(record.items).sort(), ["m/q1", "m/q2", "m/q3"]);
		const item = record.items["m/q1"]!;
		assert.equal(item.rung, 0);
		assert.equal(item.dueAt, at(1).toISOString());
		assert.deepEqual(item.history, [{ at: T0.toISOString(), source: "check", answer: "b", confidence: "certain", correct: false }]);
		assert.equal(record.attempts.length, 1);
	});

	it("a retake never advances an item, but a confident miss resets it", () => {
		let { record } = core.applyCheck(core.emptyReviews(), "m", LESSON, submission, T0);
		record = { ...record, items: { ...record.items, "m/q1": core.applyReview(record.items["m/q1"]!, LESSON.check[0]!, "a", "certain", at(1)) } };
		assert.equal(record.items["m/q1"]!.rung, 1);
		const retakeRight = core.applyCheck(record, "m", LESSON, { answers: { q1: "a", q2: "a", q3: "a", q4: "a" }, confidence: { q1: "certain", q2: "certain", q3: "certain", q4: "certain" } }, at(2));
		assert.equal(retakeRight.record.items["m/q1"]!.rung, 1, "right after the reveal is not recall");
		assert.equal(retakeRight.record.items["m/q1"]!.dueAt, record.items["m/q1"]!.dueAt);
		assert.deepEqual(retakeRight.attempt.scheduled, []);
		const retakeWrong = core.applyCheck(record, "m", LESSON, { answers: { q1: "b", q2: "a", q3: "a", q4: "a" }, confidence: { q1: "fairly", q2: "certain", q3: "certain", q4: "certain" } }, at(2));
		assert.equal(retakeWrong.record.items["m/q1"]!.rung, 0);
		assert.equal(retakeWrong.record.items["m/q1"]!.dueAt, at(3).toISOString());
		assert.deepEqual(retakeWrong.attempt.scheduled, ["q1"]);
	});

	it("a retired item that's missed confidently again comes back", () => {
		const { record } = core.applyCheck(core.emptyReviews(), "m", LESSON, submission, T0);
		const retired = { ...record.items["m/q1"]!, retiredAt: at(90).toISOString() };
		const again = core.applyCheck({ ...record, items: { ...record.items, "m/q1": retired } }, "m", LESSON, submission, at(100));
		assert.equal(again.record.items["m/q1"]!.retiredAt, undefined);
		assert.equal(again.record.items["m/q1"]!.rung, 0);
		assert.equal(again.record.items["m/q1"]!.history.length, 2, "history carries over");
	});

	it("names what is missing from a submission", () => {
		assert.equal(core.checkSubmissionProblem(LESSON, submission as never), null);
		assert.match(core.checkSubmissionProblem(LESSON, { answers: { q1: "a" }, confidence: {} })!, /q2|q1/);
		assert.match(core.checkSubmissionProblem(LESSON, { ...submission, answers: { ...submission.answers, q1: "zz" } } as never)!, /no option "zz"/);
		assert.match(core.checkSubmissionProblem(LESSON, { ...submission, confidence: { ...submission.confidence, q2: "sure" } } as never)!, /q2" has no confidence/);
	});
});

describe("the ladder", () => {
	const fresh = () => core.applyCheck(core.emptyReviews(), "m", LESSON, { answers: { q1: "b", q2: "a", q3: "a", q4: "a" }, confidence: { q1: "certain", q2: "certain", q3: "certain", q4: "certain" } }, T0).record.items["m/q1"]!;
	const q = LESSON.check[0]!;

	it("climbs 1 → 3 → 7 → 21 → 60 days, then retires", () => {
		let item = fresh();
		let now = at(1);
		for (const days of [3, 7, 21, 60]) {
			item = core.applyReview(item, q, "a", "fairly", now);
			assert.equal(item.dueAt, new Date(now.getTime() + days * DAY).toISOString(), `${days} days`);
			now = new Date(item.dueAt);
		}
		item = core.applyReview(item, q, "a", "certain", now);
		assert.ok(item.retiredAt);
		assert.equal(core.isDue(item, at(1000)), false);
	});

	it("a right guess repeats the rung; a miss starts again", () => {
		let item = core.applyReview(fresh(), q, "a", "certain", at(1));
		assert.equal(item.rung, 1);
		item = core.applyReview(item, q, "a", "guess", at(4));
		assert.equal(item.rung, 1);
		assert.equal(item.dueAt, at(7).toISOString());
		item = core.applyReview(item, q, "b", "guess", at(7));
		assert.equal(item.rung, 0);
		assert.equal(item.dueAt, at(8).toISOString());
		assert.equal(item.history.at(-1)!.source, "review");
	});

	it("lists due items oldest first and the next due date", () => {
		const { record } = core.applyCheck(core.emptyReviews(), "m", LESSON, { answers: { q1: "b", q2: "b", q3: "a", q4: "a" }, confidence: { q1: "certain", q2: "certain", q3: "certain", q4: "certain" } }, T0);
		const later = { ...record.items["m/q2"]!, dueAt: at(5).toISOString() };
		const r = { ...record, items: { ...record.items, "m/q2": later } };
		assert.deepEqual(core.dueItems(r, T0), []);
		assert.equal(core.nextDueAt(r, T0), at(1).toISOString());
		assert.deepEqual(core.dueItems(r, at(1)).map((i) => i.questionId), ["q1"]);
		assert.equal(core.nextDueAt(r, at(1)), at(5).toISOString());
		assert.deepEqual(core.dueItems(r, at(6)).map((i) => i.questionId), ["q1", "q2"]);
	});
});

describe("the file", () => {
	it("round-trips, reads a missing or corrupt file as empty, and drops malformed entries", () => {
		assert.deepEqual(readReviews(), core.emptyReviews());
		const { record } = core.applyCheck(core.emptyReviews(), "m", LESSON, { answers: { q1: "b", q2: "a", q3: "a", q4: "a" }, confidence: { q1: "certain", q2: "certain", q3: "certain", q4: "certain" } }, T0);
		writeReviews(record);
		assert.deepEqual(readReviews(), record);
		assert.deepEqual(fs.readdirSync(TMP).filter((f) => f.includes(".tmp")), [], "no temp file left behind");
		fs.writeFileSync(REVIEWS_FILE, "{ nope");
		assert.deepEqual(readReviews(), core.emptyReviews());
		fs.writeFileSync(REVIEWS_FILE, JSON.stringify({ version: 1, attempts: [{ slug: 1 }], items: { x: { slug: "m", questionId: "q1", rung: 9, dueAt: "x", addedAt: "y" }, ok: record.items["m/q1"] } }));
		const read = readReviews();
		assert.deepEqual(read.attempts, []);
		assert.deepEqual(Object.keys(read.items), ["m/q1"]);
		fs.rmSync(REVIEWS_FILE);
	});
});

const json = (url: string, method: string, body?: unknown) =>
	new Request(url, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body) });
const params = <T>(p: T) => ({ params: Promise.resolve(p) });

describe("the routes, over the shipped Loop engineering lesson", () => {
	const SLUG = "loop-engineering";
	const allRight = { "stop-rule": "termination", "checker-brief": "assume-broken", "where-state": "file", "needs-judgment": "onboarding" };

	it("POST check grades, schedules confident misses and lucky guesses, and GET returns it", async () => {
		const res = await checkRoute.POST(
			json(`http://x/api/modules/${SLUG}/check`, "POST", {
				answers: { ...allRight, "stop-rule": "feedback", "checker-brief": "faster" },
				confidence: { "stop-rule": "certain", "checker-brief": "guess", "where-state": "guess", "needs-judgment": "fairly" },
				correct: ["stop-rule", "checker-brief"],
			}),
			params({ slug: SLUG }),
		);
		assert.equal(res.status, 200);
		const { attempt } = (await res.json()) as { attempt: { correct: string[]; scheduled: string[] } };
		assert.deepEqual(attempt.correct, ["where-state", "needs-judgment"], "the client's 'correct' is ignored");
		assert.deepEqual(attempt.scheduled, ["stop-rule", "where-state"]);
		const got = (await (await checkRoute.GET(json(`http://x/api/modules/${SLUG}/check`, "GET"), params({ slug: SLUG }))).json()) as { attempt: { scheduled: string[] } };
		assert.deepEqual(got.attempt.scheduled, ["stop-rule", "where-state"]);
	});

	it("POST check refuses incomplete input and unknown modules", async () => {
		const bad = await checkRoute.POST(json(`http://x/api/modules/${SLUG}/check`, "POST", { answers: allRight, confidence: {} }), params({ slug: SLUG }));
		assert.equal(bad.status, 400);
		assert.equal((await checkRoute.POST(json("http://x", "POST", "not json"), params({ slug: SLUG }))).status, 400);
		assert.equal((await checkRoute.POST(json("http://x", "POST", { answers: {}, confidence: {} }), params({ slug: "nope" }))).status, 404);
	});

	it("GET reviews hides answers and shows nothing until a day has passed", async () => {
		const queue = (await (await queueRoute.GET()).json()) as { due: unknown[]; nextDueAt: string | null };
		assert.deepEqual(queue.due, []);
		assert.ok(queue.nextDueAt);
		const later = server.reviewQueue(new Date(Date.now() + 2 * DAY));
		assert.deepEqual(later.due.map((d) => d.questionId).sort(), ["stop-rule", "where-state"]);
		const item = later.due.find((d) => d.questionId === "stop-rule")!;
		assert.equal(item.moduleTitle, "Loop engineering");
		assert.ok(item.reviewStepTitle.length > 0);
		const wire = JSON.stringify(later);
		assert.ok(!wire.includes("explanation") && !wire.includes("misconception") && !wire.includes('"answer"'), "no answers before answering");
	});

	it("POST review grades, moves the ladder and reveals", async () => {
		const res = await answerRoute.POST(json("http://x", "POST", { answer: "termination", confidence: "certain" }), params({ slug: SLUG, questionId: "stop-rule" }));
		assert.equal(res.status, 200);
		const { verdict } = (await res.json()) as { verdict: { correct: boolean; answer: string; explanation: string; retired: boolean; nextDueAt: string } };
		assert.equal(verdict.correct, true);
		assert.equal(verdict.answer, "termination");
		assert.ok(verdict.explanation.length > 0);
		assert.equal(verdict.retired, false);
		assert.equal(readReviews().items[`${SLUG}/stop-rule`]!.rung, 1);

		const miss = (await (await answerRoute.POST(json("http://x", "POST", { answer: "history", confidence: "fairly" }), params({ slug: SLUG, questionId: "where-state" }))).json()) as { verdict: { correct: boolean; misconception: string | null } };
		assert.equal(miss.verdict.correct, false);
		assert.equal(typeof miss.verdict.misconception === "string" || miss.verdict.misconception === null, true);
	});

	it("POST review refuses bad input and unknown items", async () => {
		const call = (body: unknown, questionId = "stop-rule") => answerRoute.POST(json("http://x", "POST", body), params({ slug: SLUG, questionId }));
		assert.equal((await call({ answer: "zz", confidence: "certain" })).status, 400);
		assert.equal((await call({ answer: "termination", confidence: "sure" })).status, 400);
		assert.equal((await call({ answer: "termination", confidence: "certain" }, "needs-judgment")).status, 404, "never queued");
	});

	it("skips an item whose question left the lesson", () => {
		const record = readReviews();
		const ghost = { ...record.items[`${SLUG}/stop-rule`]!, questionId: "gone", dueAt: T0.toISOString() };
		writeReviews({ ...record, items: { ...record.items, [`${SLUG}/gone`]: ghost } });
		assert.ok(!server.reviewQueue(new Date(Date.now() + 100 * DAY)).due.some((d) => d.questionId === "gone"));
	});
});
