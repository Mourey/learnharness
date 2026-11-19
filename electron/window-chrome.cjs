/*
 * Window chrome colours (app shell, 2026-11-19): the native parts of the
 * window that sit outside the page — the Windows/Linux title bar overlay
 * (min/max/close) and the background shown while a resize outruns the
 * compositor — follow the app's theme instead of staying Night desk.
 *
 * Two sources, both reduced to {background, foreground} #rrggbb:
 *   - before React loads, the saved settings (initialChrome), so a Paper
 *     launch never opens with a dark strip;
 *   - after, the renderer's live --background/--foreground over the
 *     "lh:window-chrome" channel (chromeColors validates what arrives).
 *
 * Pure, no Electron: tests require it directly.
 */

const HEX = /^#[0-9a-f]{6}$/i;

/** Night desk and Paper, mirroring app/globals.css (tests pin the match). */
const NIGHT_DESK = Object.freeze({ background: "#111214", foreground: "#e8e8e6" });
const PAPER = Object.freeze({ background: "#ffffff", foreground: "#16181d" });

/** The renderer's colours, or null unless both are #rrggbb strings. */
function chromeColors(value) {
	if (!value || typeof value !== "object") return null;
	const { background, foreground } = value;
	if (typeof background !== "string" || typeof foreground !== "string") return null;
	if (!HEX.test(background) || !HEX.test(foreground)) return null;
	return { background: background.toLowerCase(), foreground: foreground.toLowerCase() };
}

/** The colours before the page has painted, from the saved settings record
 *  (data/settings.json; null or junk = factory Night desk). A custom
 *  background applies in dark mode only, as in the app. */
function initialChrome(record) {
	const appearance = record && typeof record === "object" ? record.appearance : null;
	if (appearance && appearance.mode === "light") return { ...PAPER };
	const custom = appearance && typeof appearance.background === "string" && HEX.test(appearance.background) ? appearance.background.toLowerCase() : null;
	return { background: custom ?? NIGHT_DESK.background, foreground: NIGHT_DESK.foreground };
}

/** Read the settings record defensively: a missing or broken file is factory. */
function readInitialChrome(settingsFile, fs) {
	try {
		return initialChrome(JSON.parse(fs.readFileSync(settingsFile, "utf8")));
	} catch {
		return initialChrome(null);
	}
}

/** Electron's titleBarOverlay shape for a colour pair. */
function overlayFor(colors) {
	return { color: colors.background, symbolColor: colors.foreground };
}

module.exports = { NIGHT_DESK, PAPER, chromeColors, initialChrome, readInitialChrome, overlayFor };
