/**
 * CONFIDENT MISSES IN THE GRAPH (reinforcement, 2026-11-19). The graph's law
 * holds: nodes stay true propositions written only by extraction, and the
 * learner's miss never enters the ledgers. Pins: what counts as a live miss;
 * the correction text the extractor reads; one stable source per question;
 * the background feed (confident misses only, once per question, skipped
 * without models, a failure never stops the rest); and the mark, derived at
 * read from data/reviews.json and drawn as a ring and a card line.
 */

import React from "react";
(globalThis as Record<string, unknown>).React = React;

import assert from "node:assert/strict";
import fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { after, describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

// ── the seams, BEFORE any config-loading import ─────────────────────────────
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "lh-review-graph-"));
process.env.LH_DATA_DIR = TMP;
process.env.LH_MODULES_DIR = path.join(process.cwd(), "modules");

const { liveMiss, lessonCheckSourcePath, correctionText, missesByNode, lessonSchema } = await import("../src/core/index.ts");
const { notesSourceId } = await import("../src/agent/subagents/extraction.ts");
const { feedMisses, withMisses } = await import("../src/server/review-graph.ts");
const { writeReviews } = await import("../src/store/reviews.ts");
const { ringedNodes } = await import("../components/graph-canvas.ts");
const { NodeMisses } = await import("../components/graph-view.tsx");
const { graphFeedMessage, checkSaveMessage } = await import("../components/lesson/check-sync.ts");
import type { CheckAttempt, NotesSource, ReviewItem, GraphSnapshot } from "../src/core/index.ts";

after(() => {
	fs.rmSync(TMP, { recursive: true, force: true });
	delete process.env.LH_MODULES_DIR;
});

const LESSON = lessonSchema.parse(JSON.parse(fs.readFileSync(path.join(process.cwd(), "modules/loop-engineering/lesson.json"), "utf8")));
const STOP_RULE = LESSON.check.find((q) => q.id === "stop-rule")!;
const T = "2026-11-19T10:00:00.000Z";

const item = (over: Partial<ReviewItem> = {}): ReviewItem => ({
	slug: "loop-engineering",
	questionId: "stop-rule",
	rung: 0,
	dueAt: "2026-11-20T10:00:00.000Z",
	addedAt: T,
	history: [{ at: T, source: "check", answer: "feedback", confidence: "certain", correct: false }],
	...over,
});

describe("a live miss", () => {
	it("is a confident wrong answer since the item was (re)added, until it retires", () => {
		assert.equal(liveMiss(item()), true);
		assert.equal(liveMiss(item({ history: [{ at: T, source: "check", answer: "feedback", confidence: "fairly", correct: false }] })), true);
		assert.equal(liveMiss(item({ history: [{ at: T, source: "check", answer: "termination", confidence: "guess", correct: true }] })), false, "a lucky guess never counts");
		assert.equal(liveMiss(item({ retiredAt: "2027-03-01T00:00:00.000Z" })), false);
		assert.equal(
			liveMiss(item({ addedAt: "2027-04-01T00:00:00.000Z", history: [{ at: T, source: "check", answer: "feedback", confidence: "certain", correct: false }, { at: "2027-04-01T00:00:00.000Z", source: "check", answer: "termination", confidence: "guess", correct: true }] })),
			false,
			"a miss from before the item was re-added doesn't carry over",
		);
	});
});

describe("the correction", () => {
	it("states the question, the answer, why, and the wrong answer chosen, in plain text", () => {
		const text = correctionText("Loop engineering", STOP_RULE, "feedback");
		const feedback = STOP_RULE.options.find((o) => o.id === "feedback")!;
		assert.match(text, /^Loop engineering: a correction/);
		assert.ok(text.includes(`Answer: ${STOP_RULE.options.find((o) => o.id === "termination")!.text.replace(/\*\*/g, "")}`));
		assert.ok(text.includes("Why: "));
		assert.ok(text.includes(`A common wrong answer is "${feedback.text}"`));
		if (feedback.misconception) assert.ok(text.includes(feedback.misconception));
		assert.ok(!/\b(you|learner|student)\b/i.test(text.split("\n")[0]!), "world-facing heading");
		assert.ok(!text.includes("**"), "inline markup flattened");
	});

	it("has one stable source per question", () => {
		const p = lessonCheckSourcePath("Loop engineering", "stop-rule");
		assert.equal(p, "Lesson check: Loop engineering / stop-rule");
		assert.equal(notesSourceId(p), notesSourceId("Lesson check: Loop engineering / stop-rule"));
		assert.notEqual(notesSourceId(p), notesSourceId(lessonCheckSourcePath("Loop engineering", "where-state")));
		assert.match(notesSourceId(p), /^src_[0-9a-f]{12}$/);
	});
});

describe("the background feed", () => {
	const attempt: CheckAttempt = {
		slug: "loop-engineering",
		at: T,
		answers: { "stop-rule": "feedback", "checker-brief": "assume-broken", "where-state": "history", "needs-judgment": "build" },
		confidence: { "stop-rule": "certain", "checker-brief": "guess", "where-state": "fairly", "needs-judgment": "guess" },
		correct: ["checker-brief"],
		scheduled: ["stop-rule", "checker-brief", "where-state"],
	};
	const deps = (over: { ready?: boolean; sources?: NotesSource[]; fail?: string } = {}) => {
		const imported: string[] = [];
		return {
			imported,
			deps: {
				ready: () => over.ready ?? true,
				sources: () => over.sources ?? [],
				sourceId: notesSourceId,
				importNotes: async (input: { filePath: string; text: string }) => {
					imported.push(input.filePath);
					if (over.fail && input.filePath.endsWith(over.fail)) throw new Error("model down");
				},
			},
		};
	};

	it("extracts each new confident miss once, never a lucky guess", async () => {
		const { imported, deps: d } = deps();
		const feed = feedMisses("loop-engineering", attempt, d);
		assert.equal(feed.status, "queued");
		assert.equal(feed.count, 2);
		await feed.done;
		assert.deepEqual(imported, ["Lesson check: Loop engineering / stop-rule", "Lesson check: Loop engineering / where-state"]);
	});

	it("skips a question whose correction was already extracted, but not one that never reached the merger", async () => {
		const done = { id: notesSourceId("Lesson check: Loop engineering / stop-rule"), filePath: "x", importedAt: T, extractions: [{ startedAt: 1, at: T, durationMs: 1, stats: { nodes: 2 }, stages: {} as never }] };
		const failed = { id: notesSourceId("Lesson check: Loop engineering / where-state"), filePath: "y", importedAt: T, extractions: [] };
		const { imported, deps: d } = deps({ sources: [done, failed] });
		const feed = feedMisses("loop-engineering", attempt, d);
		await feed.done;
		assert.deepEqual(imported, ["Lesson check: Loop engineering / where-state"]);
	});

	it("says so when the models aren't ready, and starts nothing", async () => {
		const { imported, deps: d } = deps({ ready: false });
		const feed = feedMisses("loop-engineering", attempt, d);
		assert.equal(feed.status, "skipped-no-models");
		assert.equal(feed.count, 2);
		await feed.done;
		assert.deepEqual(imported, []);
	});

	it("a failed run never stops the next", async () => {
		const { imported, deps: d } = deps({ fail: "stop-rule" });
		const warn = console.warn;
		console.warn = () => {};
		try {
			await feedMisses("loop-engineering", attempt, d).done;
		} finally {
			console.warn = warn;
		}
		assert.equal(imported.length, 2);
	});

	it("does nothing without new confident misses or for an unknown module", () => {
		const { deps: d } = deps();
		assert.equal(feedMisses("loop-engineering", { ...attempt, scheduled: ["checker-brief"] }, d).status, "none");
		assert.equal(feedMisses("nope", attempt, d).status, "none");
	});
});

describe("the mark", () => {
	const src = notesSourceId(lessonCheckSourcePath("Loop engineering", "stop-rule"));
	const snapshot = { nodeSessions: { n_a: [src, "chat_1"], n_b: ["chat_1"] } } as unknown as GraphSnapshot;

	it("maps nodes to the live misses in their provenance", () => {
		const miss = { slug: "loop-engineering", questionId: "stop-rule", moduleTitle: "Loop engineering", reviewStep: "termination" };
		assert.deepEqual(missesByNode(snapshot.nodeSessions, new Map([[src, miss]])), { n_a: [miss] });
		assert.deepEqual(missesByNode(snapshot.nodeSessions, new Map()), {});
	});

	it("is derived at read from data/reviews.json, and clears when the miss retires", () => {
		writeReviews({ version: 1, attempts: [], items: { "loop-engineering/stop-rule": item() } });
		const marked = withMisses(snapshot, notesSourceId);
		assert.deepEqual(Object.keys(marked.misses ?? {}), ["n_a"]);
		assert.equal(marked.misses!.n_a![0]!.reviewStep, STOP_RULE.reviewStep);
		writeReviews({ version: 1, attempts: [], items: { "loop-engineering/stop-rule": item({ retiredAt: "2027-03-01T00:00:00.000Z" }) } });
		assert.equal(withMisses(snapshot, notesSourceId).misses, undefined);
	});

	it("rings only marked nodes the search hasn't hidden", () => {
		const nodes = [{ id: "n_a" }, { id: "n_b" }, { id: "n_c" }];
		assert.deepEqual(ringedNodes(nodes, new Set(["n_a", "n_c"]), null).map((n) => n.id), ["n_a", "n_c"]);
		assert.deepEqual(ringedNodes(nodes, new Set(["n_a", "n_c"]), new Set(["n_c"])).map((n) => n.id), ["n_c"]);
		assert.deepEqual(ringedNodes(nodes, undefined, null), []);
	});

	it("the node card says it was missed and links back", () => {
		const html = renderToStaticMarkup(<NodeMisses misses={[{ slug: "loop-engineering", questionId: "stop-rule", moduleTitle: "Loop engineering", reviewStep: "termination" }]} />);
		assert.match(html, /You missed this while sure/);
		assert.match(html, /href="\/modules\/loop-engineering#termination"/);
		assert.match(html, /href="\/review"/);
	});
});

describe("the check's save line", () => {
	it("adds what happened in the graph", () => {
		assert.equal(graphFeedMessage("queued", 2), "Adding 2 corrections to your knowledge graph.");
		assert.equal(graphFeedMessage("skipped-no-models", 1), "Set up models in Settings to add 1 correction to your knowledge graph.");
		assert.equal(graphFeedMessage("none", 0), null);
		assert.equal(checkSaveMessage({ status: "saved", scheduled: 2, graph: "queued", graphCount: 1 }), "Saved. 2 questions added to your review queue. Adding 1 correction to your knowledge graph.");
	});
});
