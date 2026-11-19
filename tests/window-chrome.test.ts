/**
 * THEME-FOLLOWING WINDOW CHROME (2026-11-19): the Windows/Linux title bar
 * overlay and the resize background follow the app's theme. Pins: only
 * #rrggbb pairs pass the bridge; the pre-React colours come from the saved
 * mode (Paper) or custom dark background, falling back to Night desk; the
 * fixed pairs are globals.css's; and the renderer's computed rgb() colours
 * convert to the hex the bridge accepts.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { createRequire } from "node:module";
import { describe, it } from "node:test";
import { cssColorToHex } from "../components/settings/appearance.tsx";

const require = createRequire(import.meta.url);
const chrome = require("../electron/window-chrome.cjs") as {
	NIGHT_DESK: { background: string; foreground: string };
	PAPER: { background: string; foreground: string };
	chromeColors(value: unknown): { background: string; foreground: string } | null;
	initialChrome(record: unknown): { background: string; foreground: string };
	readInitialChrome(file: string, fsLike: typeof fs): { background: string; foreground: string };
	overlayFor(colors: { background: string; foreground: string }): { color: string; symbolColor: string };
};

describe("chromeColors", () => {
	it("accepts a #rrggbb pair, lower-cased", () => {
		assert.deepEqual(chrome.chromeColors({ background: "#FFFFFF", foreground: "#16181D" }), { background: "#ffffff", foreground: "#16181d" });
	});

	it("rejects anything else", () => {
		for (const bad of [null, "x", {}, { background: "#fff", foreground: "#000000" }, { background: "red", foreground: "#000000" }, { background: "#000000" }, { background: "#000000", foreground: 1 }, { background: "#00000000", foreground: "#000000" }]) {
			assert.equal(chrome.chromeColors(bad), null, JSON.stringify(bad));
		}
	});
});

describe("initialChrome", () => {
	it("Paper for a saved light mode", () => {
		assert.deepEqual(chrome.initialChrome({ appearance: { mode: "light", background: "#202020" } }), chrome.PAPER);
	});

	it("Night desk, with the saved custom background in dark mode", () => {
		assert.deepEqual(chrome.initialChrome(null), chrome.NIGHT_DESK);
		assert.deepEqual(chrome.initialChrome({ appearance: { mode: "dark" } }), chrome.NIGHT_DESK);
		assert.deepEqual(chrome.initialChrome({ appearance: { background: "#202020" } }), { background: "#202020", foreground: "#e8e8e6" });
		assert.deepEqual(chrome.initialChrome({ appearance: { background: "url(x)" } }), chrome.NIGHT_DESK);
	});

	it("a missing or broken settings file is factory", () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lh-chrome-read-"));
		try {
			assert.deepEqual(chrome.readInitialChrome(path.join(dir, "settings.json"), fs), chrome.NIGHT_DESK);
			fs.writeFileSync(path.join(dir, "settings.json"), "{ broken");
			assert.deepEqual(chrome.readInitialChrome(path.join(dir, "settings.json"), fs), chrome.NIGHT_DESK);
			fs.writeFileSync(path.join(dir, "settings.json"), JSON.stringify({ appearance: { mode: "light" } }));
			assert.deepEqual(chrome.readInitialChrome(path.join(dir, "settings.json"), fs), chrome.PAPER);
		} finally {
			fs.rmSync(dir, { recursive: true, force: true });
		}
	});

	it("the overlay shape is Electron's", () => {
		assert.deepEqual(chrome.overlayFor(chrome.PAPER), { color: "#ffffff", symbolColor: "#16181d" });
	});
});

describe("the fixed pairs", () => {
	const css = fs.readFileSync(path.join(process.cwd(), "app/globals.css"), "utf8");
	const token = (selector: string, name: string) => {
		const start = css.indexOf(`\n${selector} {`);
		const body = css.slice(start, css.indexOf("\n}", start));
		return new RegExp(`${name}:\\s*([^;]+);`).exec(body)?.[1]?.trim();
	};

	it("match globals.css's Night desk and Paper", () => {
		assert.equal(token(".dark", "--background"), chrome.NIGHT_DESK.background);
		assert.equal(token(".dark", "--foreground"), chrome.NIGHT_DESK.foreground);
		assert.equal(token(".light", "--background"), chrome.PAPER.background);
		assert.equal(token(".light", "--foreground"), chrome.PAPER.foreground);
	});
});

describe("cssColorToHex", () => {
	it("converts the computed colours browsers report", () => {
		assert.equal(cssColorToHex("rgb(17, 18, 20)"), "#111214");
		assert.equal(cssColorToHex("rgb(255 255 255)"), "#ffffff");
		assert.equal(cssColorToHex("rgba(22, 24, 29, 1)"), "#16181d");
		assert.equal(cssColorToHex("#E8E8E6"), "#e8e8e6");
	});

	it("refuses translucent or unknown colours", () => {
		assert.equal(cssColorToHex("rgba(0, 0, 0, 0)"), null);
		assert.equal(cssColorToHex("rgb(0 0 0 / 50%)"), null);
		assert.equal(cssColorToHex("rgb(300, 0, 0)"), null);
		assert.equal(cssColorToHex("oklch(0.5 0.1 200)"), null);
		assert.equal(cssColorToHex("transparent"), null);
	});
});
