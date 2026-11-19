import fs from "node:fs";
import { Readable } from "node:stream";
import { moduleVideoPath, parseByteRange } from "@/src/server";

/**
 * A module's rendered explainer video, streamed from modules/<slug>/ with
 * Range support so the player can seek. Renders are gitignored: a module
 * that hasn't been rendered on this machine answers 404, and the module
 * page shows how to render it instead of a player.
 */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
	const { slug } = await params;
	const file = moduleVideoPath(slug);
	if (!file) return Response.json({ error: "video not rendered" }, { status: 404 });
	const size = fs.statSync(file).size;
	const range = parseByteRange(req.headers.get("range"), size);
	const headers: Record<string, string> = { "Content-Type": "video/mp4", "Accept-Ranges": "bytes", "Cache-Control": "no-cache" };
	if (range === "unsatisfiable") {
		return new Response(null, { status: 416, headers: { ...headers, "Content-Range": `bytes */${size}` } });
	}
	const span = range ?? { start: 0, end: size - 1 };
	const stream = Readable.toWeb(fs.createReadStream(file, { start: span.start, end: span.end })) as ReadableStream;
	return new Response(stream, {
		status: range ? 206 : 200,
		headers: {
			...headers,
			"Content-Length": String(span.end - span.start + 1),
			...(range ? { "Content-Range": `bytes ${span.start}-${span.end}/${size}` } : {}),
		},
	});
}
