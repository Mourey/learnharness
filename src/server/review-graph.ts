import {
	correctionText,
	lessonCheckSourcePath,
	liveMiss,
	missesByNode,
	type CheckAttempt,
	type GraphMiss,
	type GraphSnapshot,
	type NotesSource,
} from "../core/index.ts";
import { readReviews } from "../store/reviews.ts";
import { readModuleLesson, readModuleManifest } from "./modules.ts";

/**
 * Confident misses in the graph, server side (reinforcement, 2026-11-19).
 *
 *   - feedMisses: after a check is graded, each newly queued confident
 *     miss sends its true correction through the notes front door — one
 *     source per question, extracted at most once, in the background,
 *     one run at a time. Skipped up front when the extraction models
 *     aren't ready, so no empty source record is left behind.
 *   - withMisses: the graph snapshot plus the derived mark — nodes whose
 *     provenance includes a live miss's correction source. Read-only.
 */

export type GraphFeed = "queued" | "skipped-no-models" | "none";

export interface FeedDeps {
	/** Whether an extraction run would start (models + provider keys). */
	ready: () => boolean;
	/** The notes sources on record. */
	sources: () => NotesSource[];
	sourceId: (filePath: string) => string;
	importNotes: (input: { filePath: string; text: string }) => Promise<unknown>;
}

/** Already extracted: the source exists and a run of it reached the merger. */
function extracted(sources: NotesSource[], id: string): boolean {
	return sources.some((s) => s.id === id && (s.extractions ?? []).some((run) => run.stats !== undefined));
}

/** Start the background extractions for an attempt's new confident misses. `done` settles when they finish. */
export function feedMisses(slug: string, attempt: CheckAttempt, deps: FeedDeps): { status: GraphFeed; count: number; done: Promise<void> } {
	const none = { status: "none" as const, count: 0, done: Promise.resolve() };
	const lesson = readModuleLesson(slug);
	const title = readModuleManifest(slug)?.title;
	if (!lesson || !title) return none;
	const sources = deps.sources();
	const jobs = attempt.scheduled
		.map((id) => lesson.check.find((q) => q.id === id))
		.filter((q): q is NonNullable<typeof q> => !!q)
		.filter((q) => attempt.answers[q.id] !== q.answer && attempt.confidence[q.id] !== "guess")
		.map((q) => ({ filePath: lessonCheckSourcePath(title, q.id), text: correctionText(title, q, attempt.answers[q.id]!) }))
		.filter((job) => !extracted(sources, deps.sourceId(job.filePath)));
	if (jobs.length === 0) return none;
	if (!deps.ready()) return { status: "skipped-no-models", count: jobs.length, done: Promise.resolve() };
	const done = (async () => {
		for (const job of jobs) {
			try {
				await deps.importNotes(job);
			} catch (error) {
				console.warn(`[review-graph] extracting "${job.filePath}" failed:`, error instanceof Error ? error.message : error);
			}
		}
	})();
	return { status: "queued", count: jobs.length, done };
}

/** Live misses keyed by their correction source id. */
export function liveMissSources(sourceId: (filePath: string) => string): Map<string, GraphMiss> {
	const out = new Map<string, GraphMiss>();
	for (const item of Object.values(readReviews().items)) {
		if (!liveMiss(item)) continue;
		const title = readModuleManifest(item.slug)?.title;
		const question = title ? readModuleLesson(item.slug)?.check.find((q) => q.id === item.questionId) : undefined;
		if (!title || !question) continue;
		out.set(sourceId(lessonCheckSourcePath(title, item.questionId)), { slug: item.slug, questionId: item.questionId, moduleTitle: title, reviewStep: question.reviewStep });
	}
	return out;
}

/** The snapshot with the derived mark attached (absent when nothing is marked). */
export function withMisses(snapshot: GraphSnapshot, sourceId: (filePath: string) => string): GraphSnapshot {
	const misses = missesByNode(snapshot.nodeSessions, liveMissSources(sourceId));
	return Object.keys(misses).length > 0 ? { ...snapshot, misses } : snapshot;
}
