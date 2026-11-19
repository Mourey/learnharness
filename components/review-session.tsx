"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRightIcon } from "lucide-react";
import { TopBar } from "@/components/top-bar";
import Question from "@/components/lesson/question";
import type { Confidence } from "@/src/core";

/**
 * SPACED REVIEW (reinforcement, 2026-11-19): the questions a learner got
 * wrong while sure, or right while guessing, come back here on a ladder
 * (1, 3, 7, 21, 60 days). One at a time: answer, say how sure you are, see
 * the reveal, move on. The server grades and reschedules; answers stay
 * hidden until the learner commits.
 */

/** A due question as GET /api/reviews sends it (src/server/reviews.ts DueReview). */
export interface DueReview {
	slug: string;
	moduleTitle: string;
	questionId: string;
	prompt: string;
	options: { id: string; text: string }[];
	reviewStep: string;
	reviewStepTitle: string;
	rung: number;
	dueAt: string;
}

export interface ReviewVerdict {
	correct: boolean;
	answer: string;
	misconception: string | null;
	explanation: string;
	retired: boolean;
	nextDueAt: string | null;
}

const CONFIDENCE_LABELS: { id: Confidence; label: string }[] = [
	{ id: "guess", label: "Guessing" },
	{ id: "fairly", label: "Fairly sure" },
	{ id: "certain", label: "Certain" },
];

const DAY_MS = 86_400_000;

/** When something is next due, in words: "today", "tomorrow", "in 3 days", or a date. */
export function formatDue(iso: string, now: Date): string {
	const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
	const days = Math.round((startOf(new Date(iso)) - startOf(now)) / DAY_MS);
	if (days <= 0) return "today";
	if (days === 1) return "tomorrow";
	if (days < 14) return `in ${days} days`;
	return `on ${new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
}

/** What the reveal says about the item's future. */
export function verdictSchedule(verdict: ReviewVerdict, now: Date): string {
	if (verdict.retired) return "That one has held through every interval. It won't come back.";
	if (!verdict.nextDueAt) return "";
	return `It comes back ${formatDue(verdict.nextDueAt, now)}.`;
}

export async function answerReview(item: Pick<DueReview, "slug" | "questionId">, answer: string, confidence: Confidence, fetchLike: typeof fetch): Promise<ReviewVerdict> {
	const res = await fetchLike(`/api/reviews/${encodeURIComponent(item.slug)}/${encodeURIComponent(item.questionId)}`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ answer, confidence }),
	});
	if (!res.ok) throw new Error(`the answer wasn't saved (${res.status})`);
	return ((await res.json()) as { verdict: ReviewVerdict }).verdict;
}

export function ReviewSession({ due, nextDueAt }: { due: DueReview[]; nextDueAt: string | null }) {
	const [index, setIndex] = useState(0);
	const [selected, setSelected] = useState<string | undefined>();
	const [confidence, setConfidence] = useState<Confidence | undefined>();
	const [verdict, setVerdict] = useState<ReviewVerdict | null>(null);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [held, setHeld] = useState(0);
	const [upcoming, setUpcoming] = useState(nextDueAt);
	const now = new Date();
	const item = due[index];

	const commit = () => {
		if (!item || !selected || !confidence || busy) return;
		setBusy(true);
		setError(null);
		answerReview(item, selected, confidence, fetch)
			.then((v) => {
				setVerdict(v);
				if (v.correct) setHeld((n) => n + 1);
				if (v.nextDueAt && (!upcoming || v.nextDueAt < upcoming)) setUpcoming(v.nextDueAt);
			})
			.catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
			.finally(() => setBusy(false));
	};
	const next = () => {
		setIndex((i) => i + 1);
		setSelected(undefined);
		setConfidence(undefined);
		setVerdict(null);
	};

	const question = item && {
		prompt: item.prompt,
		options: item.options.map((o) => ({ ...o, misconception: verdict && o.id === selected ? (verdict.misconception ?? undefined) : undefined })),
		answer: verdict?.answer ?? "",
		explanation: verdict?.explanation ?? "",
	};

	return (
		<div className="flex h-dvh flex-col">
			<TopBar>
				<span className="font-ui text-xs uppercase tracking-widest text-muted-foreground">Review</span>
			</TopBar>
			<div className="min-h-0 flex-1 overflow-y-auto">
				<div className="lh-lesson mx-auto w-full max-w-3xl px-4 py-10 sm:px-8">
					<h1 className="font-prose text-3xl font-bold tracking-tight">Review</h1>
					<p className="mt-2 max-w-[60ch] font-prose text-lg text-muted-foreground">
						The questions you got wrong while sure, or right while guessing, come back until they hold: after 1, 3, 7, 21 and 60 days.
					</p>

					{item && question ? (
						<section data-testid="review-item" className="mt-8 rounded-[10px] border border-border bg-card p-5 sm:p-6" aria-label={`Question ${index + 1} of ${due.length}`}>
							<p className="font-ui text-xs text-muted-foreground">
								<span className="text-lh-signal">{String(index + 1).padStart(2, "0")}</span> / {String(due.length).padStart(2, "0")} · {item.moduleTitle}
							</p>
							<div className="mt-3">
								<Question key={`${item.slug}/${item.questionId}`} question={question} selected={selected} committed={!!verdict} headingLevel="h3" onSelect={setSelected} />
							</div>
							<div className="lesson-confidence" role="radiogroup" aria-label="How sure are you?">
								{CONFIDENCE_LABELS.map((c) => (
									<button key={c.id} type="button" role="radio" aria-checked={confidence === c.id} disabled={!!verdict} onClick={() => setConfidence(c.id)}>
										{c.label}
									</button>
								))}
							</div>
							{verdict ? (
								<div className="mt-5 flex flex-wrap items-baseline gap-x-6 gap-y-3">
									<p data-testid="review-schedule" className="m-0 font-ui text-sm text-muted-foreground">
										{verdictSchedule(verdict, now)}{" "}
										<Link className="lesson-link" href={`/modules/${item.slug}#${item.reviewStep}`}>
											Revisit “{item.reviewStepTitle}”
										</Link>
									</p>
									<button type="button" data-testid="review-next" className="lesson-action !mt-0" onClick={next}>
										{index + 1 < due.length ? "Next" : "Finish"} <ArrowRightIcon className="size-3.5" />
									</button>
								</div>
							) : (
								<div className="mt-5">
									<button type="button" data-testid="review-commit" className="lesson-action !mt-0" disabled={!selected || !confidence || busy} onClick={commit}>
										{busy ? "Checking…" : "Check answer"}
									</button>
									{(!selected || !confidence) && <p className="lesson-hint">Pick an answer and say how sure you are.</p>}
									{error && <p className="mt-2 font-ui text-xs text-lh-fail">{error}</p>}
								</div>
							)}
						</section>
					) : (
						<section data-testid="review-empty" className="mt-8 rounded-[10px] border border-border bg-card p-6">
							<p className="m-0 font-prose text-lg">
								{due.length > 0 ? `Done for now: ${held} of ${due.length} held.` : "Nothing is due."}
							</p>
							<p className="mt-2 font-ui text-sm text-muted-foreground">
								{upcoming
									? `Your next review is ${formatDue(upcoming, now)}.`
									: "Take a lesson check in a module: anything you get wrong while sure, or right while guessing, lands here."}{" "}
								<Link className="lesson-link" href="/modules">
									Modules
								</Link>
							</p>
						</section>
					)}
				</div>
			</div>
		</div>
	);
}
