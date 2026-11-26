import { extraction, extractionReady, feedMisses, latestCheck, notesSourceId, stores, submitCheck } from "@/src/server";

/**
 * A module's lesson check, saved server-side (reinforcement, 2026-11-19).
 *
 *   POST {answers, confidence} → 200 {attempt}: graded against the lesson on
 *        disk; confident misses and lucky guesses join the review queue
 *        (attempt.scheduled). 400 for an incomplete or unknown answer, 404
 *        when the module has no lesson.
 *        `graph` says what happened to the new confident misses' corrections:
 *        "queued" (extracting in the background, `graphCount` of them),
 *        "skipped-no-models" (extraction models or keys not set up) or
 *        "none". The response never waits on extraction.
 *   GET  → 200 {attempt} — the latest submission, or null.
 */

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
	const { slug } = await params;
	return Response.json({ attempt: latestCheck(slug) });
}

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
	const { slug } = await params;
	let body: unknown;
	try {
		body = await req.json();
	} catch {
		return Response.json({ error: "body must be JSON" }, { status: 400 });
	}
	const result = submitCheck(slug, body);
	if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
	const feed = feedMisses(slug, result.value, {
		ready: extractionReady,
		sources: () => stores.graphStore.readSources(),
		sourceId: notesSourceId,
		importNotes: (input) => extraction.importNotes(input),
	});
	return Response.json({ attempt: result.value, graph: feed.status, graphCount: feed.count });
}
