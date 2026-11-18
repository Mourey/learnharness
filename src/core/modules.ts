import { z } from "zod";
import { plainText } from "./lesson-inline.ts";
import type { Lesson } from "./lesson-schema.ts";

/**
 * LEARNING MODULES: one topic taught three ways. A module is a folder under
 * modules/<slug>/ holding a module.json manifest, an explainer video (a
 * HyperFrames project whose render is gitignored), an interactive lesson
 * (rho's lesson JSON) and the source the tutor teaches from.
 *
 * This file is the pure half: the manifest schema, the shapes the shell
 * renders, and the tutor's context text. src/server/modules.ts reads the
 * files.
 */

export const moduleSlug = /^[a-z][a-z0-9-]*$/;

export const moduleManifestSchema = z.object({
	title: z.string().min(1),
	summary: z.string().min(1),
	/** Paths relative to the module folder. */
	video: z.object({ file: z.string().min(1), duration: z.string().min(1) }).optional(),
	lesson: z.string().min(1).optional(),
	/** A page in the wiki, relative to LH_WIKI_DIR. Read at tutor start, never committed. */
	wikiSource: z.string().min(1).optional(),
});

export type ModuleManifest = z.infer<typeof moduleManifestSchema>;

/** What the library and the module page render. */
export interface ModuleSummary {
	slug: string;
	title: string;
	summary: string;
	/** The video's declared length, and whether its render exists on disk. */
	video: { duration: string; rendered: boolean } | null;
	lesson: { steps: number; duration: string } | null;
	/** Whether the wiki page resolved, so the tutor can say what it reads. */
	wikiAvailable: boolean;
}

/** The tutor context marker's UI payload (never model-visible). */
export interface ModuleContextData {
	slug: string;
	title: string;
	sources: string[];
}

/** The longest wiki excerpt handed to the tutor, in characters (about 10k tokens). */
export const WIKI_EXCERPT_LIMIT = 40_000;

/** Drop a leading YAML frontmatter block; the tutor needs the prose. */
export function stripFrontmatter(markdown: string): string {
	return markdown.replace(/^---\n[\s\S]*?\n---\n?/, "").trim();
}

/**
 * The model-facing context a module tutor session starts with: the lesson the
 * learner has (or will) walk through, step by step, its check questions with
 * their answers, and the wiki page the lesson was written from when it is
 * available. Bracketed like the graph-context marker: it arrives on the user
 * channel, so it must read as injected session context, not learner speech.
 */
export function moduleContextText(title: string, lesson: Lesson | null, wiki: string | null): string {
	const lines = [
		`[Session context] — the learner opened this session from the "${title}" module. Teach from this material: it is what the learner has been building and studying. The module also has an explainer video and an interactive lesson with the same content.`,
	];
	if (lesson) {
		lines.push("", `Lesson: ${lesson.title}. ${plainText(lesson.description)}`, "", "Steps:");
		lesson.steps.forEach((s, i) => {
			lines.push(`${i + 1}. ${s.title} — ${s.body.map(plainText).join(" ")}`);
			if (s.callout) lines.push(`   (${s.callout.kind}) ${plainText(s.callout.text)}`);
		});
		lines.push("", "The lesson's check questions (the answer follows each):");
		for (const q of lesson.check) {
			const answer = q.options.find((o) => o.id === q.answer);
			lines.push(`- ${plainText(q.prompt)} → ${answer ? plainText(answer.text) : q.answer}`);
		}
	}
	if (wiki) {
		const body = stripFrontmatter(wiki);
		const excerpt = body.length > WIKI_EXCERPT_LIMIT ? `${body.slice(0, WIKI_EXCERPT_LIMIT)}\n[…truncated]` : body;
		lines.push("", "The wiki page this module was written from:", "", excerpt);
	}
	return lines.join("\n");
}
