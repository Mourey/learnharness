/**
 * MODULES IN THE PACKAGED APP (2026-11-19): build-server.mjs copies the
 * module library into the standalone server folder, whose cwd/modules the
 * server reads with no LH_MODULES_DIR. Pins: only runtime files ship
 * (manifest, lesson, render when present), never the HyperFrames source;
 * paths that escape a module folder are refused; a missing render ships the
 * module without it; the copy replaces what was there; the build script's
 * slug pattern is the app's; and the packaged page explains a missing video
 * instead of printing a render command the learner can't run.
 */

import React from "react";
(globalThis as Record<string, unknown>).React = React;

import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { after, describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { MODULE_SLUG, packageModules } from "../scripts/package-modules.mjs";
import { moduleSlug } from "../src/core/modules.ts";
import { isDesktopServer } from "../src/server/modules.ts";
import { VideoMissingNote } from "../components/module-view.tsx";

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "lh-package-modules-"));
after(() => fs.rmSync(TMP, { recursive: true, force: true }));

const quiet = { warn: (..._args: unknown[]) => {} };

function tree(files: Record<string, string>) {
	const root = fs.mkdtempSync(path.join(TMP, "src-"));
	for (const [rel, body] of Object.entries(files)) {
		fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
		fs.writeFileSync(path.join(root, rel), body);
	}
	return root;
}

function listFiles(dir: string): string[] {
	if (!fs.existsSync(dir)) return [];
	return (fs.readdirSync(dir, { recursive: true }) as string[])
		.filter((rel) => fs.statSync(path.join(dir, rel)).isFile())
		.map((rel) => rel.split(path.sep).join("/"))
		.sort();
}

const manifest = (extra: object = {}) => JSON.stringify({ title: "T", summary: "S", ...extra });

describe("packageModules", () => {
	it("ships the manifest, the lesson and the render, and nothing of the video's source", () => {
		const src = tree({
			"loops/module.json": manifest({ lesson: "lesson.json", video: { file: "video/renders/loops.mp4", duration: "1:48" } }),
			"loops/lesson.json": "{}",
			"loops/video/renders/loops.mp4": "mp4",
			"loops/video/assets/voice/b01.wav": "wav",
			"loops/video/index.html": "<html>",
			"loops/video/.hyperframes/cache": "x",
		});
		const dest = path.join(TMP, "dest-full");
		const shipped = packageModules(src, dest, quiet);
		assert.deepEqual(listFiles(dest), ["loops/lesson.json", "loops/module.json", "loops/video/renders/loops.mp4"]);
		assert.deepEqual(shipped, [{ slug: "loops", files: ["module.json", "lesson.json", "video/renders/loops.mp4"], lesson: true, video: true }]);
	});

	it("ships a module without its render when it was never rendered, and says so", () => {
		const src = tree({ "loops/module.json": manifest({ video: { file: "video/renders/loops.mp4", duration: "1:48" } }) });
		const warnings: string[] = [];
		const shipped = packageModules(src, path.join(TMP, "dest-unrendered"), { warn: (m: string) => warnings.push(m) });
		assert.equal(shipped[0]!.video, false);
		assert.deepEqual(shipped[0]!.files, ["module.json"]);
		assert.ok(warnings.some((w) => /video not rendered/.test(w)));
	});

	it("refuses paths that escape the module folder", () => {
		const src = tree({
			"a/module.json": manifest({ lesson: "../b/lesson.json", video: { file: "../../secret.mp4", duration: "0:01" } }),
			"b/module.json": manifest(),
			"b/lesson.json": "{}",
			"secret.mp4": "no",
		});
		const dest = path.join(TMP, "dest-escape");
		packageModules(src, dest, quiet);
		assert.deepEqual(listFiles(dest), ["a/module.json", "b/module.json"]);
	});

	it("skips folders that aren't modules and manifests that aren't JSON", () => {
		const src = tree({
			"Not_A_Slug/module.json": manifest(),
			"no-manifest/lesson.json": "{}",
			"broken/module.json": "{ not json",
			"good/module.json": manifest(),
		});
		const shipped = packageModules(src, path.join(TMP, "dest-skip"), quiet);
		assert.deepEqual(shipped.map((m) => m.slug), ["good"]);
	});

	it("replaces whatever the destination held, and copes with no modules folder", () => {
		const dest = path.join(TMP, "dest-replace");
		fs.mkdirSync(path.join(dest, "loops", "video", "assets"), { recursive: true });
		fs.writeFileSync(path.join(dest, "loops", "video", "assets", "traced.wav"), "traced");
		packageModules(tree({ "loops/module.json": manifest() }), dest, quiet);
		assert.deepEqual(listFiles(dest), ["loops/module.json"]);
		assert.deepEqual(packageModules(path.join(TMP, "missing"), dest, quiet), []);
		assert.equal(fs.existsSync(dest), false);
	});

	it("ships the repository's Loop engineering module", () => {
		const dest = path.join(TMP, "dest-repo");
		const shipped = packageModules(path.join(process.cwd(), "modules"), dest, quiet);
		const loop = shipped.find((m) => m.slug === "loop-engineering");
		assert.ok(loop);
		assert.equal(loop.lesson, true);
		assert.ok(!listFiles(dest).some((f) => f.endsWith(".wav")), "no voice tracks");
	});

	it("uses the app's slug pattern", () => {
		assert.equal(MODULE_SLUG.source, moduleSlug.source);
	});
});

describe("a missing video in the packaged app", () => {
	it("explains the build left it out instead of printing the render command", () => {
		const html = renderToStaticMarkup(<VideoMissingNote slug="loops" packaged />);
		assert.match(html, /This build doesn&#x27;t include the video/);
		assert.ok(!html.includes("hyperframes"));
	});

	it("keeps the render command in a dev checkout", () => {
		const html = renderToStaticMarkup(<VideoMissingNote slug="loops" packaged={false} />);
		assert.match(html, /npx hyperframes render --quality delivery/);
		assert.match(html, /modules\/loops\/video/);
	});

	it("knows it is the packaged server from LH_DESKTOP_SERVER", () => {
		const before = process.env.LH_DESKTOP_SERVER;
		try {
			delete process.env.LH_DESKTOP_SERVER;
			assert.equal(isDesktopServer(), false);
			process.env.LH_DESKTOP_SERVER = "1";
			assert.equal(isDesktopServer(), true);
		} finally {
			if (before === undefined) delete process.env.LH_DESKTOP_SERVER;
			else process.env.LH_DESKTOP_SERVER = before;
		}
	});
});
