/**
 * Persistence for spaced review (reinforcement, 2026-11-19):
 * data/reviews.json (config.REVIEWS_FILE), under the LH_DATA_DIR seam.
 * Read-modify-write, sanitized on read (core/reviews.ts), written atomically
 * so a crash mid-write never leaves half a file.
 */

import fs from "node:fs";
import path from "node:path";
import { REVIEWS_FILE } from "../../config.ts";
import { emptyReviews, sanitizeReviews, type ReviewsRecord } from "../core/reviews.ts";

/** The record; a missing or corrupt file reads as empty. */
export function readReviews(): ReviewsRecord {
	let raw: string;
	try {
		raw = fs.readFileSync(REVIEWS_FILE, "utf-8");
	} catch {
		return emptyReviews();
	}
	try {
		return sanitizeReviews(JSON.parse(raw)) ?? emptyReviews();
	} catch {
		console.warn("[reviews] reviews.json is not valid JSON; reading as empty");
		return emptyReviews();
	}
}

export function writeReviews(record: ReviewsRecord): void {
	fs.mkdirSync(path.dirname(REVIEWS_FILE), { recursive: true });
	const tmp = `${REVIEWS_FILE}.${process.pid}.tmp`;
	fs.writeFileSync(tmp, JSON.stringify(record, null, "\t"), "utf-8");
	fs.renameSync(tmp, REVIEWS_FILE);
}
