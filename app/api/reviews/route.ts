import { reviewQueue } from "@/src/server";

/**
 * GET /api/reviews (reinforcement, 2026-11-19) → 200 {due, nextDueAt}: the
 * due review questions, oldest first, without their answers (answering
 * reveals them), and when the next not-yet-due item comes up.
 */

export const dynamic = "force-dynamic";

export async function GET() {
	return Response.json(reviewQueue());
}
