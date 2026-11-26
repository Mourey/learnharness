import { plainText } from "./lesson-inline.ts";
import type { CheckQuestion } from "./lesson-schema.ts";
import type { ReviewItem } from "./reviews.ts";

/**
 * CONFIDENT MISSES IN THE GRAPH (reinforcement, 2026-11-19), the pure half.
 *
 * The graph's law (contracts/graph.ts, docs/vision.md §1): every node is a
 * TRUE proposition, the extraction pipeline is the only writer, and a
 * misconception enters as its true correction — the learner's holding of
 * the wrong idea never lives in the graph. So a confident miss reaches the
 * graph twice over, never as a stored miss:
 *
 *   - its CORRECTION goes through the notes front door as one source per
 *     question (lessonCheckSourcePath), extracted like an imported file;
 *   - the MARK is derived on read: nodes whose provenance includes the
 *     source of a still-live miss (missesByNode), from data/reviews.json.
 */

/** A confident miss that still counts: not retired, and answered wrong while
 *  fairly sure or certain since it was (re)added to the queue. Lucky guesses
 *  never count. */
export function liveMiss(item: ReviewItem): boolean {
	if (item.retiredAt) return false;
	return item.history.some((h) => h.at >= item.addedAt && !h.correct && h.confidence !== "guess");
}

/** The notes-source path for one check question: its identity (the source id
 *  hashes it) and the label the node card shows. */
export function lessonCheckSourcePath(moduleTitle: string, questionId: string): string {
	return `Lesson check: ${moduleTitle} / ${questionId}`;
}

/** The correction the extractor reads: the question, the right answer, why,
 *  and the wrong answer the learner chose, set against the correction —
 *  world-facing statements, no learner or session in them. */
export function correctionText(moduleTitle: string, question: CheckQuestion, chosenOptionId: string): string {
	const right = question.options.find((o) => o.id === question.answer);
	const chosen = question.options.find((o) => o.id === chosenOptionId);
	const lines = [
		`${moduleTitle}: a correction`,
		"",
		`Question: ${plainText(question.prompt)}`,
		`Answer: ${plainText(right?.text ?? question.answer)}`,
		`Why: ${plainText(question.explanation)}`,
	];
	if (chosen && chosen.id !== question.answer) {
		lines.push(`A common wrong answer is "${plainText(chosen.text)}".${chosen.misconception ? ` ${plainText(chosen.misconception)}` : ""}`);
	}
	return lines.join("\n");
}

/** One live miss as the graph view shows it. */
export interface GraphMiss {
	slug: string;
	questionId: string;
	moduleTitle: string;
	reviewStep: string;
}

/**
 * Derive the mark: node id → the live misses whose correction source is in
 * that node's provenance. `liveSources` maps a source id to its miss.
 */
export function missesByNode(nodeSessions: Record<string, string[]>, liveSources: ReadonlyMap<string, GraphMiss>): Record<string, GraphMiss[]> {
	const out: Record<string, GraphMiss[]> = {};
	if (liveSources.size === 0) return out;
	for (const [nodeId, sources] of Object.entries(nodeSessions)) {
		const misses = sources.map((id) => liveSources.get(id)).filter((m): m is GraphMiss => !!m);
		if (misses.length > 0) out[nodeId] = misses;
	}
	return out;
}
