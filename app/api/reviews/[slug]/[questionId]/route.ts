import { answerReview } from "@/src/server";

/**
 * POST /api/reviews/[slug]/[questionId] {answer, confidence} (reinforcement,
 * 2026-11-19) → 200 {verdict}: graded against the lesson, the item moves on
 * the ladder, and the verdict reveals the answer, the chosen option's
 * misconception and the explanation. 400 for a bad answer or confidence,
 * 404 for an unknown or retired item.
 */

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ slug: string; questionId: string }> }) {
	const { slug, questionId } = await params;
	let body: unknown;
	try {
		body = await req.json();
	} catch {
		return Response.json({ error: "body must be JSON" }, { status: 400 });
	}
	const result = answerReview(slug, questionId, body);
	return result.ok ? Response.json({ verdict: result.value }) : Response.json({ error: result.error }, { status: result.status });
}
