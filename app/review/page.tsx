import "@/components/lesson/lesson.css";
import { ReviewSession } from "@/components/review-session";
import { reviewQueue } from "@/src/server";

// Dynamic: what's due depends on the clock and on data/reviews.json.
export const dynamic = "force-dynamic";

export default function ReviewPage() {
	const { due, nextDueAt } = reviewQueue();
	return <ReviewSession due={due} nextDueAt={nextDueAt} />;
}
