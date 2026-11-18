"use client";

import Link from "next/link";
import { LibraryIcon } from "lucide-react";
import type { ModuleContextData } from "@/src/core";

/**
 * The module-context card (app shell, 2026-11-18): message[0] of a tutor
 * session started from a learning module. Scaffolding, not a turn: one
 * muted line naming the module and what the tutor was given (the lesson,
 * the wiki page), linking back to the module. The model reads the
 * material itself through the marker's text.
 */
export function ModuleContextCard({ data }: { data: ModuleContextData }) {
	const { slug, title, sources = [] } = data ?? ({} as ModuleContextData);
	return (
		<div data-testid="module-context-card" className="my-1">
			<div className="flex w-full items-center gap-2 rounded-lg border border-dashed border-border/70 px-3 py-2 text-xs text-muted-foreground">
				<LibraryIcon aria-hidden="true" className="size-3.5 shrink-0" />
				<span className="font-medium">Module</span>
				<Link href={`/modules/${slug}`} className="text-foreground/80 underline-offset-2 hover:underline">
					{title}
				</Link>
				{sources.length > 0 && <span className="min-w-0 flex-1 truncate">· tutor reads the {sources.join(" and ")}</span>}
			</div>
		</div>
	);
}
