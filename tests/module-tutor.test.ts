/**
 * THE MODULE TUTOR (app shell, 2026-11-18): "Ask the tutor" on a module
 * starts a teach session whose message[0] is a module-context marker, the
 * graph-context marker's pattern. Pins: the marker carries the module's
 * material to the model and only a small payload to the UI; it is neutral
 * input (never a learner turn) and never swallows the opening prompt; the
 * route refuses an unknown module BEFORE creating a chat; practice
 * sessions ignore it; the launcher builds the create-then-redirect target.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { after, describe, it } from "node:test";

// ── the seams, BEFORE any config-loading import ─────────────────────────────
const TMP_DATA = fs.mkdtempSync(path.join(os.tmpdir(), "lh-module-tutor-"));
process.env.LH_DATA_DIR = TMP_DATA;
process.env.LH_MODULES_DIR = path.join(process.cwd(), "modules");
delete process.env.LH_WIKI_DIR;

const { newModuleContextMessage, nativeInputCause, toLlmMessages } = await import("../src/core/native-messages.ts");
import type { LhMessage } from "../src/core/native-messages.ts";
const { projectView } = await import("../src/core/view.ts");
const { POST } = await import("../app/api/chats/route.ts");
const { initialPromptOwed } = await import("../components/chat.tsx");
const { startModuleTutor, defaultTutorPrompt } = await import("../components/module-view.tsx");
const { chatStore } = await import("../src/store/chats.ts");

after(() => {
	fs.rmSync(TMP_DATA, { recursive: true, force: true });
	delete process.env.LH_MODULES_DIR;
});

const post = (body: unknown) =>
	POST(new Request("http://x/api/chats", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }));

describe("the module-context marker", () => {
	const marker = newModuleContextMessage({ slug: "loop-engineering", title: "Loop engineering", sources: ["interactive lesson"] }, "[Session context] material");

	it("is a displayed custom message whose content is the model's and details the UI's", () => {
		assert.equal(marker.role, "custom");
		assert.equal(marker.customType, "module-context");
		assert.equal(marker.content, "[Session context] material");
		assert.deepEqual(marker.details, { slug: "loop-engineering", title: "Loop engineering", sources: ["interactive lesson"] });
	});

	it("is neutral input: it never counts as a learner turn", () => {
		assert.equal(nativeInputCause(marker as never, []), "neutral");
	});

	it("reaches the model as text and the transcript as a card", () => {
		const wire = toLlmMessages([marker as LhMessage]);
		assert.ok(JSON.stringify(wire).includes("[Session context] material"));
		const view = projectView([marker as LhMessage]);
		assert.equal(view.length, 1);
		assert.equal(view[0]!.parts[0]!.type, "data-module-context");
		assert.ok(!JSON.stringify(view).includes("[Session context] material"), "the model text never reaches the view");
	});

	it("never swallows the opening prompt", () => {
		assert.equal(initialPromptOwed([marker as never], "teach me"), true);
	});
});

describe("POST /api/chats with moduleContext", () => {
	it("creates a teach session whose message[0] carries the shipped module's lesson", async () => {
		const res = await post({ title: "Loop engineering: teach me", moduleContext: { slug: "loop-engineering" } });
		assert.equal(res.status, 200);
		const { id } = (await res.json()) as { id: string };
		const chat = chatStore.getChat(id)!;
		assert.equal(chat.kind ?? "teach", "teach");
		const first = chat.messages[0] as { customType?: string; content?: string; details?: { sources?: string[] } };
		assert.equal(first.customType, "module-context");
		assert.ok(first.content?.includes("Loop engineering"));
		assert.ok(first.content?.includes("Steps:"));
		assert.deepEqual(first.details?.sources, ["interactive lesson"], "no LH_WIKI_DIR: the lesson only");
	});

	it("refuses an unknown module without creating a chat", async () => {
		const before = chatStore.listChats().length;
		const res = await post({ title: "x", moduleContext: { slug: "no-such-module" } });
		assert.equal(res.status, 404);
		assert.equal(chatStore.listChats().length, before);
	});

	it("practice sessions ignore it", async () => {
		const res = await post({ title: "drill", kind: "practice", moduleContext: { slug: "loop-engineering" } });
		const { id } = (await res.json()) as { id: string };
		assert.equal(chatStore.getChat(id)!.messages.length, 0);
	});
});

describe("the launcher", () => {
	const fakeFetch = (status = 200) => {
		const calls: { url: string; body: unknown }[] = [];
		const f = (async (url: string, init?: RequestInit) => {
			calls.push({ url, body: JSON.parse(String(init?.body)) });
			return new Response(JSON.stringify({ id: "chat_1", title: "t" }), { status });
		}) as unknown as typeof fetch;
		return { f, calls };
	};

	it("sends the module slug and redirects with the opening prompt", async () => {
		const { f, calls } = fakeFetch();
		const target = await startModuleTutor("loop-engineering", "Loop engineering", "  why a separate checker?  ", f);
		assert.equal(target, `/chat/chat_1?prompt=${encodeURIComponent("why a separate checker?")}`);
		assert.deepEqual(calls[0]!.body, { title: "Loop engineering: why a separate checker?", moduleContext: { slug: "loop-engineering" } });
	});

	it("an empty field opens with the default prompt", async () => {
		const { f } = fakeFetch();
		const target = await startModuleTutor("loop-engineering", "Loop engineering", "", f);
		assert.ok(target.endsWith(encodeURIComponent(defaultTutorPrompt("Loop engineering"))));
	});

	it("rejects when the server refuses", async () => {
		const { f } = fakeFetch(404);
		await assert.rejects(startModuleTutor("gone", "Gone", "", f), /404/);
	});
});
