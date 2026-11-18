/**
 * NIGHT DESK + PAPER (app shell, 2026-11-18): the app's two themes. Dark is
 * Night desk, light is Paper, chosen in Settings → Appearance → Mode and
 * applied as a class on <html>. Pins: exactly one mode class at a time; the
 * custom background (a dark-curve derivation) applies in dark only; both
 * palettes define every token the app and the lesson read; and the signal
 * colours are the design's hexes.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { appearanceVars, applyModeClass, resolveAppearance } from "../components/settings/appearance.tsx";

const css = fs.readFileSync(path.join(process.cwd(), "app/globals.css"), "utf8");

/** The declarations inside the first top-level block opened by `selector {`. */
function block(selector: string): Record<string, string> {
	const start = css.indexOf(`\n${selector} {`);
	assert.ok(start >= 0, `${selector} block exists`);
	const body = css.slice(css.indexOf("{", start) + 1, css.indexOf("\n}", start));
	return Object.fromEntries([...body.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1]!, m[2]!.trim()]));
}

function fakeClassList() {
	const set = new Set<string>();
	return { set, toggle: (name: string, force?: boolean) => (force ? set.add(name) : set.delete(name), !!force) };
}

describe("the mode class", () => {
	it("puts exactly one of dark / light on the root", () => {
		const list = fakeClassList();
		applyModeClass(list, "light");
		assert.deepEqual([...list.set], ["light"]);
		applyModeClass(list, "dark");
		assert.deepEqual([...list.set], ["dark"]);
	});

	it("defaults to dark (Night desk)", () => {
		assert.equal(resolveAppearance(undefined).mode, "dark");
	});
});

describe("the custom background", () => {
	it("derives the palette in dark mode only", () => {
		assert.equal(appearanceVars(resolveAppearance({ background: "#202020" }))["--background"], "#202020");
		assert.equal(appearanceVars(resolveAppearance({ mode: "light", background: "#202020" }))["--background"], undefined);
	});
});

describe("the palettes", () => {
	const TOKENS = [
		"--background", "--foreground", "--card", "--popover", "--primary", "--primary-foreground",
		"--muted", "--muted-foreground", "--accent", "--border", "--input", "--ring", "--destructive",
		"--lh-signal", "--lh-fail", "--lh-pass", "--lh-fail-tint", "--lh-pass-tint", "--lh-grid", "--lh-rail-tick",
	];

	it("dark (:root and .dark) and light (.light) each define every token", () => {
		for (const sel of [":root", ".dark", ".light"]) {
			const b = block(sel);
			for (const t of TOKENS) assert.ok(b[t], `${sel} defines ${t}`);
		}
	});

	it(":root and .dark agree (the dark variant stays coherent)", () => {
		const root = block(":root");
		const dark = block(".dark");
		for (const t of TOKENS) assert.equal(dark[t], root[t], t);
	});

	it("carries the design's hexes", () => {
		const night = block(".dark");
		assert.equal(night["--background"], "#111214");
		assert.equal(night["--card"], "#17181b");
		assert.equal(night["--border"], "#2c2e33");
		assert.equal(night["--lh-signal"], "#8fa6ff");
		assert.equal(night["--lh-fail"], "#f0866f");
		assert.equal(night["--lh-pass"], "#7fcf97");
		const paper = block(".light");
		assert.equal(paper["--background"], "#ffffff");
		assert.equal(paper["--foreground"], "#16181d");
		assert.equal(paper["--lh-signal"], "#2348c9");
		assert.equal(paper["--lh-pass"], "#22603a");
	});

	it("Tailwind sees the signal colours", () => {
		for (const t of ["--color-lh-signal: var(--lh-signal)", "--color-lh-fail: var(--lh-fail)", "--color-lh-pass: var(--lh-pass)"]) {
			assert.ok(css.includes(t), t);
		}
	});
});
