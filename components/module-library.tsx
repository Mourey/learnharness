"use client";

import Link from "next/link";
import { BookOpenIcon, MessageCircleIcon, PlayIcon } from "lucide-react";
import { TopBar } from "@/components/top-bar";
import type { ModuleSummary } from "@/src/core";

/**
 * THE MODULE LIBRARY (app shell, 2026-11-18): every topic we have built
 * becomes a module, taught three ways: an explainer video to see it work,
 * the interactive lesson to walk through it, and the tutor to reinforce it.
 * Cards list which of the three each module has.
 */

export function moduleWays(m: ModuleSummary): { key: string; label: string }[] {
	return [
		m.video && { key: "video", label: m.video.rendered ? `Video ${m.video.duration}` : "Video not rendered" },
		m.lesson && { key: "lesson", label: `Lesson ${m.lesson.steps} steps` },
		{ key: "tutor", label: "Tutor" },
	].filter((w): w is { key: string; label: string } => !!w);
}

const wayIcon = { video: PlayIcon, lesson: BookOpenIcon, tutor: MessageCircleIcon } as const;

export function ModuleLibrary({ modules }: { modules: ModuleSummary[] }) {
	return (
		<div className="flex h-dvh flex-col">
			<TopBar>
				<span className="font-ui text-xs uppercase tracking-widest text-muted-foreground">Modules</span>
			</TopBar>
			<div className="min-h-0 flex-1 overflow-y-auto">
				<div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-8">
					<h1 className="font-prose text-3xl font-bold tracking-tight">Learn what we have built</h1>
					<p className="mt-2 max-w-[60ch] font-prose text-lg text-muted-foreground">
						Each module teaches one topic three ways: watch the explainer, walk through the lesson, then work it through with the tutor.
					</p>
					{modules.length === 0 ? (
						<p data-testid="modules-empty" className="mt-10 font-ui text-sm text-muted-foreground">
							No modules yet. Add a folder with a module.json under modules/.
						</p>
					) : (
						<ul className="mt-8 grid gap-4 sm:grid-cols-2">
							{modules.map((m) => (
								<li key={m.slug}>
									<Link
										href={`/modules/${m.slug}`}
										data-testid="module-card"
										className="group flex h-full flex-col rounded-[10px] border border-border bg-card p-5 transition-colors hover:border-lh-signal"
									>
										<span className="font-prose text-xl font-bold tracking-tight group-hover:text-lh-signal">{m.title}</span>
										<span className="mt-2 flex-1 font-prose text-base leading-relaxed text-muted-foreground">{m.summary}</span>
										<span className="mt-4 flex flex-wrap gap-2">
											{moduleWays(m).map((w) => {
												const Icon = wayIcon[w.key as keyof typeof wayIcon];
												return (
													<span key={w.key} className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 font-ui text-xs text-muted-foreground">
														<Icon className="size-3" />
														{w.label}
													</span>
												);
											})}
										</span>
									</Link>
								</li>
							))}
						</ul>
					)}
				</div>
			</div>
		</div>
	);
}
