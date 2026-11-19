/**
 * package-modules.mjs — curate the module library for the packaged server.
 *
 * The standalone server runs with its own folder as cwd, so modules copied
 * to .next/standalone/modules are found by src/server/modules.ts's
 * cwd/modules fallback with no LH_MODULES_DIR. Only what the app reads at
 * runtime ships: each module's module.json, the lesson file it names, and
 * the video render it names WHEN it exists (renders are gitignored, so a
 * machine that never rendered ships the module without its video). The
 * HyperFrames source project — voice wavs, compositions, caches — stays out.
 *
 * Plain Node (build-time, no TS): the slug pattern mirrors moduleSlug in
 * src/core/modules.ts, and tests pin the two together.
 */
import * as fs from "node:fs";
import * as path from "node:path";

export const MODULE_SLUG = /^[a-z][a-z0-9-]*$/;

/** Resolve a path inside a base directory, or null when it would escape it. */
function inside(base, relative) {
	const root = path.resolve(base);
	const resolved = path.resolve(root, relative);
	return resolved.startsWith(root + path.sep) ? resolved : null;
}

const isFile = (p) => fs.existsSync(p) && fs.statSync(p).isFile();

/**
 * Copy the runtime files of every module under `src` into `dest`, replacing
 * whatever `dest` held. Returns one report per shipped module.
 *
 * @param {string} src
 * @param {string} dest
 * @param {{ warn: (message: string) => void }} [log]
 */
export function packageModules(src, dest, log = console) {
	fs.rmSync(dest, { recursive: true, force: true });
	if (!fs.existsSync(src)) return [];
	const shipped = [];
	for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
		if (!entry.isDirectory() || !MODULE_SLUG.test(entry.name)) continue;
		const dir = path.join(src, entry.name);
		const manifestPath = path.join(dir, "module.json");
		if (!isFile(manifestPath)) continue;
		let manifest;
		try {
			manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
		} catch (error) {
			log.warn(`[package-modules] skipping ${entry.name}: module.json is not valid JSON (${error.message})`);
			continue;
		}
		const files = ["module.json"];
		const wanted = (relative, label) => {
			if (typeof relative !== "string") return false;
			const file = inside(dir, relative);
			if (!file) {
				log.warn(`[package-modules] ${entry.name}: ${label} path escapes the module folder, not shipped: ${relative}`);
				return false;
			}
			if (!isFile(file)) return false;
			files.push(path.relative(dir, file));
			return true;
		};
		const lesson = manifest.lesson === undefined ? null : wanted(manifest.lesson, "lesson");
		const video = manifest.video === undefined ? null : wanted(manifest.video?.file, "video");
		if (video === false) log.warn(`[package-modules] ${entry.name}: video not rendered, shipping without it`);
		for (const relative of files) {
			const to = path.join(dest, entry.name, relative);
			fs.mkdirSync(path.dirname(to), { recursive: true });
			fs.copyFileSync(path.join(dir, relative), to);
		}
		shipped.push({ slug: entry.name, files, lesson, video });
	}
	return shipped.sort((a, b) => a.slug.localeCompare(b.slug));
}
