/**
 * LEARNING MODULES (app shell, 2026-11-18): the module library's file side
 * and its pure core. Pins: the shipped Loop engineering module parses
 * (manifest + rho lesson JSON through the ported schema); the loader skips
 * broken modules instead of failing the page; every path stays inside its
 * root (slug, video, lesson, wiki); the video route serves byte ranges so
 * the player can seek; and the tutor's context carries the lesson and,
 * only when LH_WIKI_DIR resolves, the wiki page without its frontmatter.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { after, describe, it } from "node:test";

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "lh-modules-"));
const MODULES = path.join(TMP, "modules");
const WIKI = path.join(TMP, "wiki");
fs.mkdirSync(MODULES);
fs.mkdirSync(path.join(WIKI, "concepts"), { recursive: true });

const { lessonSchema, moduleContextText, stripFrontmatter, WIKI_EXCERPT_LIMIT } = await import("../src/core/index.ts");
const server = await import("../src/server/modules.ts");
const { GET: videoGET } = await import("../app/api/modules/[slug]/video/route.ts");
const { moduleWays } = await import("../components/module-library.tsx");

after(() => {
	fs.rmSync(TMP, { recursive: true, force: true });
	delete process.env.LH_MODULES_DIR;
	delete process.env.LH_WIKI_DIR;
});

const REPO_LESSON = JSON.parse(fs.readFileSync(path.join(process.cwd(), "modules/loop-engineering/lesson.json"), "utf8"));

function writeModule(slug: string, manifest: unknown, files: Record<string, string | Buffer> = {}) {
	const dir = path.join(MODULES, slug);
	fs.mkdirSync(dir, { recursive: true });
	fs.writeFileSync(path.join(dir, "module.json"), typeof manifest === "string" ? manifest : JSON.stringify(manifest));
	for (const [name, body] of Object.entries(files)) {
		fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
		fs.writeFileSync(path.join(dir, name), body);
	}
}

const VIDEO_BYTES = Buffer.from(Array.from({ length: 100 }, (_, i) => i));

writeModule(
	"loops",
	{ title: "Loops", summary: "The loop.", video: { file: "video/out.mp4", duration: "1:48" }, lesson: "lesson.json", wikiSource: "concepts/loops.md" },
	{ "lesson.json": JSON.stringify(REPO_LESSON), "video/out.mp4": VIDEO_BYTES },
);
writeModule("unrendered", { title: "Another", summary: "No render yet.", video: { file: "video/out.mp4", duration: "0:30" } });
writeModule("broken-json", "{ not json");
writeModule("broken-lesson", { title: "Broken lesson", summary: "Lesson fails the schema.", lesson: "lesson.json" }, { "lesson.json": "{}" });
writeModule("escape", { title: "Escape", summary: "Tries to leave its folder.", video: { file: "../loops/video/out.mp4", duration: "0:01" }, lesson: "../loops/lesson.json" });
fs.mkdirSync(path.join(MODULES, "Not_A_Slug"));
fs.writeFileSync(path.join(MODULES, "Not_A_Slug", "module.json"), JSON.stringify({ title: "Bad slug", summary: "x" }));
fs.writeFileSync(path.join(WIKI, "concepts/loops.md"), "---\ntitle: Loops\ntags: [x]\n---\n# Loop engineering\n\nThe wiki body.\n");
process.env.LH_MODULES_DIR = MODULES;

describe("the shipped module", () => {
	it("Loop engineering's lesson parses through the ported schema", () => {
		const lesson = lessonSchema.parse(REPO_LESSON);
		assert.equal(lesson.title, "Loop engineering");
		assert.ok(lesson.steps.length >= 2);
	});

	it("its manifest names a lesson, a video and a wiki source", () => {
		const manifest = JSON.parse(fs.readFileSync(path.join(process.cwd(), "modules/loop-engineering/module.json"), "utf8"));
		assert.equal(manifest.lesson, "lesson.json");
		assert.equal(manifest.video.file, "video/renders/loop-engineering.mp4");
		assert.equal(manifest.wikiSource, "concepts/loop-engineering.md");
	});
});

describe("the loader", () => {
	it("lists valid modules sorted by title, skipping broken manifests and non-slug folders", () => {
		const slugs = server.listModules().map((m) => m.slug);
		assert.deepEqual(slugs, ["unrendered", "broken-lesson", "escape", "loops"]);
	});

	it("a module whose lesson fails the schema still lists, without a lesson", () => {
		const m = server.moduleSummary("broken-lesson");
		assert.ok(m);
		assert.equal(m.lesson, null);
	});

	it("summarizes video, lesson and wiki availability", () => {
		const m = server.moduleSummary("loops")!;
		assert.deepEqual(m.video, { duration: "1:48", rendered: true });
		assert.equal(m.lesson?.steps, REPO_LESSON.steps.length);
		assert.equal(m.wikiAvailable, false, "no LH_WIKI_DIR yet");
		assert.deepEqual(server.moduleSummary("unrendered")!.video, { duration: "0:30", rendered: false });
	});

	it("never resolves a path outside the module folder", () => {
		assert.equal(server.moduleVideoPath("escape"), null);
		assert.equal(server.readModuleLesson("escape"), null);
		assert.equal(server.moduleSummary("../modules/loops"), null);
		assert.equal(server.moduleSummary("Not_A_Slug"), null);
		assert.equal(server.insideDir("/a/b", "../b2/x"), null);
		assert.equal(server.insideDir("/a/b", "c/d"), path.resolve("/a/b/c/d"));
	});
});

describe("parseByteRange", () => {
	it("parses the three single-range forms", () => {
		assert.deepEqual(server.parseByteRange("bytes=0-9", 100), { start: 0, end: 9 });
		assert.deepEqual(server.parseByteRange("bytes=90-", 100), { start: 90, end: 99 });
		assert.deepEqual(server.parseByteRange("bytes=-10", 100), { start: 90, end: 99 });
		assert.deepEqual(server.parseByteRange("bytes=50-500", 100), { start: 50, end: 99 }, "end clamps to the file");
	});

	it("answers null (whole file) without a usable header, and unsatisfiable past the end", () => {
		assert.equal(server.parseByteRange(null, 100), null);
		assert.equal(server.parseByteRange("bytes=0-1,5-6", 100), null);
		assert.equal(server.parseByteRange("bytes=100-", 100), "unsatisfiable");
		assert.equal(server.parseByteRange("bytes=9-3", 100), "unsatisfiable");
		assert.equal(server.parseByteRange("bytes=-0", 100), "unsatisfiable");
	});
});

describe("the video route", () => {
	const call = (slug: string, range?: string) =>
		videoGET(new Request(`http://x/api/modules/${slug}/video`, { headers: range ? { range } : {} }), { params: Promise.resolve({ slug }) });

	it("serves the whole file with Accept-Ranges", async () => {
		const res = await call("loops");
		assert.equal(res.status, 200);
		assert.equal(res.headers.get("accept-ranges"), "bytes");
		assert.equal(res.headers.get("content-type"), "video/mp4");
		assert.equal(Buffer.from(await res.arrayBuffer()).length, 100);
	});

	it("serves a byte range as 206 with Content-Range", async () => {
		const res = await call("loops", "bytes=10-19");
		assert.equal(res.status, 206);
		assert.equal(res.headers.get("content-range"), "bytes 10-19/100");
		assert.deepEqual([...Buffer.from(await res.arrayBuffer())], Array.from({ length: 10 }, (_, i) => i + 10));
	});

	it("416 past the end, 404 when not rendered or unknown", async () => {
		assert.equal((await call("loops", "bytes=200-")).status, 416);
		assert.equal((await call("unrendered")).status, 404);
		assert.equal((await call("nope")).status, 404);
		assert.equal((await call("escape")).status, 404);
	});
});

describe("the tutor's context", () => {
	it("carries every lesson step and each check question's answer", () => {
		const lesson = lessonSchema.parse(REPO_LESSON);
		const text = moduleContextText("Loops", lesson, null);
		assert.ok(text.startsWith("[Session context]"));
		for (const s of lesson.steps) assert.ok(text.includes(s.title), `step "${s.title}"`);
		assert.ok(!text.includes("**"), "inline markup is flattened to plain text");
		assert.ok(!text.includes("wiki page this module"), "no wiki section without a wiki");
	});

	it("reads the wiki page only when LH_WIKI_DIR resolves, without its frontmatter", () => {
		assert.ok(!server.moduleContext("loops")!.text.includes("The wiki body."));
		assert.deepEqual(server.moduleContext("loops")!.sources, ["interactive lesson"]);
		process.env.LH_WIKI_DIR = WIKI;
		const ctx = server.moduleContext("loops")!;
		assert.ok(ctx.text.includes("The wiki body."));
		assert.ok(!ctx.text.includes("tags: [x]"));
		assert.deepEqual(ctx.sources, ["interactive lesson", "wiki page"]);
		assert.equal(server.moduleSummary("loops")!.wikiAvailable, true);
		assert.equal(server.moduleContext("nope"), null);
	});

	it("truncates a long wiki page", () => {
		const text = moduleContextText("X", null, "a".repeat(WIKI_EXCERPT_LIMIT + 10));
		assert.ok(text.endsWith("[…truncated]"));
		assert.equal(stripFrontmatter("---\na: 1\n---\nbody"), "body");
		assert.equal(stripFrontmatter("no frontmatter"), "no frontmatter");
	});
});

describe("library cards", () => {
	it("name which of the three ways a module has", () => {
		const loops = server.moduleSummary("loops")!;
		assert.deepEqual(moduleWays(loops).map((w) => w.label), ["Video 1:48", `Lesson ${REPO_LESSON.steps.length} steps`, "Tutor"]);
		assert.deepEqual(moduleWays(server.moduleSummary("unrendered")!).map((w) => w.label), ["Video not rendered", "Tutor"]);
	});
});
