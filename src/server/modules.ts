import fs from "node:fs";
import path from "node:path";
import { lessonSchema, type Lesson } from "../core/lesson-schema.ts";
import { moduleContextText, moduleManifestSchema, moduleSlug, type ModuleManifest, type ModuleSummary } from "../core/modules.ts";

/**
 * The module library's file side. Modules live in the repository under
 * modules/<slug>/ (LH_MODULES_DIR overrides, as LH_DATA_DIR does for data).
 * The wiki is the learner's own notes, outside the repository: LH_WIKI_DIR
 * points at it, and a module's wikiSource is read only when a tutor session
 * starts, so private notes never land in git.
 *
 * Every read is defensive: a module with a broken manifest or lesson is left
 * out of the library (and logged) instead of failing the page.
 */

export function modulesRoot(): string {
	return process.env.LH_MODULES_DIR ?? path.join(process.cwd(), "modules");
}

/** Resolve a path inside a base directory, or null when it would escape it. */
export function insideDir(base: string, relative: string): string | null {
	const resolved = path.resolve(base, relative);
	const root = path.resolve(base);
	return resolved === root || resolved.startsWith(root + path.sep) ? resolved : null;
}

function moduleDir(slug: string): string | null {
	if (!moduleSlug.test(slug)) return null;
	const dir = insideDir(modulesRoot(), slug);
	return dir && fs.existsSync(path.join(dir, "module.json")) ? dir : null;
}

export function readModuleManifest(slug: string): ModuleManifest | null {
	const dir = moduleDir(slug);
	if (!dir) return null;
	try {
		return moduleManifestSchema.parse(JSON.parse(fs.readFileSync(path.join(dir, "module.json"), "utf8")));
	} catch (error) {
		console.warn(`[modules] ${slug}/module.json is invalid:`, error instanceof Error ? error.message : error);
		return null;
	}
}

export function readModuleLesson(slug: string): Lesson | null {
	const dir = moduleDir(slug);
	const manifest = readModuleManifest(slug);
	if (!dir || !manifest?.lesson) return null;
	const file = insideDir(dir, manifest.lesson);
	if (!file || !fs.existsSync(file)) return null;
	try {
		return lessonSchema.parse(JSON.parse(fs.readFileSync(file, "utf8")));
	} catch (error) {
		console.warn(`[modules] ${slug}/${manifest.lesson} is invalid:`, error instanceof Error ? error.message : error);
		return null;
	}
}

/** The rendered video on disk, or null when the module has none or it isn't rendered yet. */
export function moduleVideoPath(slug: string): string | null {
	const dir = moduleDir(slug);
	const manifest = readModuleManifest(slug);
	if (!dir || !manifest?.video) return null;
	const file = insideDir(dir, manifest.video.file);
	return file && fs.existsSync(file) && fs.statSync(file).isFile() ? file : null;
}

function wikiPath(manifest: ModuleManifest): string | null {
	const root = process.env.LH_WIKI_DIR;
	if (!root || !manifest.wikiSource) return null;
	const file = insideDir(root, manifest.wikiSource);
	return file && fs.existsSync(file) && fs.statSync(file).isFile() ? file : null;
}

export function readModuleWiki(slug: string): string | null {
	const manifest = readModuleManifest(slug);
	const file = manifest && wikiPath(manifest);
	return file ? fs.readFileSync(file, "utf8") : null;
}

export function moduleSummary(slug: string): ModuleSummary | null {
	const manifest = readModuleManifest(slug);
	if (!manifest) return null;
	const lesson = readModuleLesson(slug);
	return {
		slug,
		title: manifest.title,
		summary: manifest.summary,
		video: manifest.video ? { duration: manifest.video.duration, rendered: moduleVideoPath(slug) !== null } : null,
		lesson: lesson ? { steps: lesson.steps.length, duration: lesson.duration } : null,
		wikiAvailable: wikiPath(manifest) !== null,
	};
}

export function listModules(): ModuleSummary[] {
	const root = modulesRoot();
	if (!fs.existsSync(root)) return [];
	return fs
		.readdirSync(root, { withFileTypes: true })
		.filter((entry) => entry.isDirectory() && moduleSlug.test(entry.name))
		.map((entry) => moduleSummary(entry.name))
		.filter((m): m is ModuleSummary => m !== null)
		.sort((a, b) => a.title.localeCompare(b.title));
}

/** The tutor session's opening context, or null for an unknown module. */
export function moduleContext(slug: string): { title: string; text: string; sources: string[] } | null {
	const manifest = readModuleManifest(slug);
	if (!manifest) return null;
	const lesson = readModuleLesson(slug);
	const wiki = readModuleWiki(slug);
	const sources = [lesson && "interactive lesson", wiki && "wiki page"].filter((s): s is string => !!s);
	return { title: manifest.title, text: moduleContextText(manifest.title, lesson, wiki), sources };
}

/**
 * Parse a single-range HTTP Range header ("bytes=start-end", "bytes=start-",
 * "bytes=-suffix") against a file size. Returns the inclusive byte span, null
 * for no header (serve the whole file), or "unsatisfiable" (416). Multi-range
 * requests are served whole, which browsers' media elements accept.
 */
export function parseByteRange(header: string | null, size: number): { start: number; end: number } | null | "unsatisfiable" {
	if (!header) return null;
	const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
	if (!match) return null;
	const [, a, b] = match;
	if (a === "" && b === "") return "unsatisfiable";
	let start: number;
	let end: number;
	if (a === "") {
		const suffix = Number(b);
		if (suffix === 0) return "unsatisfiable";
		start = Math.max(0, size - suffix);
		end = size - 1;
	} else {
		start = Number(a);
		end = b === "" ? size - 1 : Math.min(Number(b), size - 1);
	}
	if (start >= size || start > end) return "unsatisfiable";
	return { start, end };
}
