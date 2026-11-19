"use client";

import { useEffect, useState } from "react";

/**
 * The sidebar's due-review count (reinforcement, 2026-11-19): re-read on
 * every navigation, so finishing a review or a lesson check updates it.
 * Null until the first answer (and when the request fails): no badge.
 */
export function useDueReviewCount(pathname: string | null): number | null {
	const [count, setCount] = useState<number | null>(null);
	useEffect(() => {
		let alive = true;
		fetch("/api/reviews")
			.then((r) => (r.ok ? (r.json() as Promise<{ due: unknown[] }>) : null))
			.then((body) => {
				if (alive) setCount(body ? body.due.length : null);
			})
			.catch(() => {});
		return () => {
			alive = false;
		};
	}, [pathname]);
	return count;
}

/** The badge text, or null for no badge. */
export function dueBadge(count: number | null): string | null {
	if (!count) return null;
	return count > 99 ? "99+" : String(count);
}
