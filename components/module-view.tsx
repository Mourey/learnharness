"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightIcon } from "lucide-react";
import { TopBar } from "@/components/top-bar";
import LessonPlayer from "@/components/lesson/lesson-player";
import type { Lesson, ModuleSummary } from "@/src/core";

/**
 * ONE MODULE (app shell, 2026-11-18): the topic taught three ways, in the
 * order that builds understanding: see it work (the explainer video), walk
 * through it and predict (the interactive lesson), then reinforce it with
 * the tutor, which starts from the module's lesson and wiki page.
 */

/** The tutor's opening message when the learner leaves the field empty. */
export function defaultTutorPrompt(title: string): string {
	return `Teach me ${title}. Start by finding out what I already understand.`;
}

/**
 * Start a tutor session for a module: create the chat with the module's
 * context marker (the server reads the lesson and wiki page), then return
 * the push target whose initialPrompt path sends the opening message as
 * turn 1, the same contract as the new-session draft. Injected fetch so
 * tests pin it. Rethrows on transport failure (the caller resets busy).
 */
export async function startModuleTutor(slug: string, title: string, text: string, fetchLike: typeof fetch): Promise<string> {
	const prompt = text.trim() || defaultTutorPrompt(title);
	const res = await fetchLike("/api/chats", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ title: `${title}: ${prompt}`, moduleContext: { slug } }),
	});
	if (!res.ok) throw new Error(`could not start the tutor (${res.status})`);
	const { id } = (await res.json()) as { id: string };
	return `/chat/${id}?prompt=${encodeURIComponent(prompt)}`;
}

function Section({ id, step, title, children }: { id: string; step: string; title: string; children: React.ReactNode }) {
	return (
		<section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-6 border-t border-border pt-8">
			<p className="font-ui text-xs text-lh-signal">{step}</p>
			<h2 id={`${id}-title`} className="mt-1 font-prose text-2xl font-bold tracking-tight">
				{title}
			</h2>
			<div className="mt-5">{children}</div>
		</section>
	);
}

function TutorLauncher({ slug, title, wikiAvailable }: { slug: string; title: string; wikiAvailable: boolean }) {
	const router = useRouter();
	const [text, setText] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const start = () => {
		if (busy) return;
		setBusy(true);
		setError(null);
		startModuleTutor(slug, title, text, fetch)
			.then((target) => router.push(target))
			.catch((e: unknown) => {
				setBusy(false);
				setError(e instanceof Error ? e.message : String(e));
			});
	};
	return (
		<div className="rounded-[10px] border border-border bg-card p-5">
			<p className="max-w-[62ch] font-prose text-base leading-relaxed text-muted-foreground">
				The tutor starts from this module&apos;s lesson{wikiAvailable ? " and the wiki page it was written from" : ""}, finds the edge of what you
				understand, and teaches from there. What you work through lands in your knowledge graph.
			</p>
			{!wikiAvailable && (
				<p data-testid="tutor-wiki-missing" className="mt-2 font-ui text-xs text-muted-foreground">
					Set LH_WIKI_DIR to your wiki folder to give the tutor the source page too.
				</p>
			)}
			<form
				className="mt-4 flex flex-col gap-2 sm:flex-row"
				onSubmit={(e) => {
					e.preventDefault();
					start();
				}}
			>
				<input
					data-testid="tutor-prompt"
					value={text}
					onChange={(e) => setText(e.target.value)}
					placeholder={defaultTutorPrompt(title)}
					className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 font-prose text-base placeholder:text-muted-foreground/70 focus:border-lh-signal"
				/>
				<button
					type="submit"
					data-testid="tutor-start"
					disabled={busy}
					className="inline-flex items-center justify-center gap-2 rounded-lg border border-lh-signal px-4 py-2 font-ui text-sm text-lh-signal transition-colors hover:bg-accent disabled:opacity-50"
				>
					{busy ? "Starting…" : "Ask the tutor"}
					<ArrowRightIcon className="size-3.5" />
				</button>
			</form>
			{error && <p className="mt-2 font-ui text-xs text-lh-fail">{error}</p>}
		</div>
	);
}

/**
 * What stands in for a video whose render is missing. In a dev checkout the
 * learner can render it; the packaged app was built without it, so the
 * command would mean nothing there.
 */
export function VideoMissingNote({ slug, packaged }: { slug: string; packaged: boolean }) {
	return (
		<div data-testid="module-video-missing" className="rounded-[10px] border border-dashed border-border p-6 font-ui text-sm text-muted-foreground">
			{packaged ? (
				<>This build doesn&apos;t include the video. The lesson and the tutor below cover the same ground.</>
			) : (
				<>
					The video hasn&apos;t been rendered on this machine. In modules/{slug}/video, run{" "}
					<code className="text-foreground">npx hyperframes render --quality delivery</code>.
				</>
			)}
		</div>
	);
}

export function ModuleView({ module: m, lesson, packaged = false }: { module: ModuleSummary; lesson: Lesson | null; packaged?: boolean }) {
	const ways = [
		m.video && { href: "#watch", label: "Watch", detail: m.video.duration },
		lesson && { href: "#lesson", label: "Walk through", detail: `${lesson.steps.length} steps · ${lesson.duration}` },
		{ href: "#tutor", label: "Ask the tutor", detail: "reinforce it" },
	].filter((w): w is { href: string; label: string; detail: string } => !!w);
	let step = 0;
	const next = () => `${String(++step).padStart(2, "0")}`;
	return (
		<div className="flex h-dvh flex-col">
			<TopBar>
				<nav aria-label="Breadcrumb" className="flex items-center gap-2 font-ui text-xs uppercase tracking-widest text-muted-foreground">
					<Link href="/modules" className="hover:text-foreground">
						Modules
					</Link>
					<span aria-hidden="true">/</span>
					<span className="text-foreground">{m.title}</span>
				</nav>
			</TopBar>
			<div className="min-h-0 flex-1 overflow-y-auto">
				<div className="lh-lesson mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-10 sm:px-8">
					<header>
						<h1 className="font-prose text-4xl font-bold tracking-tight">{m.title}</h1>
						<p className="mt-3 max-w-[62ch] text-lg leading-relaxed text-muted-foreground">{m.summary}</p>
						<ol className="mt-6 flex flex-wrap gap-2">
							{ways.map((w, i) => (
								<li key={w.href}>
									<a
										href={w.href}
										className="inline-flex items-baseline gap-2 rounded-lg border border-border px-3 py-2 font-ui text-sm transition-colors hover:border-lh-signal"
									>
										<span className="text-lh-signal">{String(i + 1).padStart(2, "0")}</span>
										{w.label}
										<span className="text-xs text-muted-foreground">{w.detail}</span>
									</a>
								</li>
							))}
						</ol>
					</header>

					{m.video && (
						<Section id="watch" step={next()} title="Watch it work">
							{m.video.rendered ? (
								<video
									data-testid="module-video"
									controls
									preload="metadata"
									className="aspect-video w-full rounded-[10px] border border-border bg-black"
									src={`/api/modules/${m.slug}/video`}
								/>
							) : (
								<VideoMissingNote slug={m.slug} packaged={packaged} />
							)}
						</Section>
					)}

					{lesson && (
						<Section id="lesson" step={next()} title="Walk through it">
							<LessonPlayer slug={m.slug} scene={lesson.scene} metrics={lesson.metrics} steps={lesson.steps} check={lesson.check} />
						</Section>
					)}

					<Section id="tutor" step={next()} title="Make it stick">
						<TutorLauncher slug={m.slug} title={m.title} wikiAvailable={m.wikiAvailable} />
					</Section>
				</div>
			</div>
		</div>
	);
}
