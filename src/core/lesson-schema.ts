import { z } from "zod";

// An interactive lesson is a sequence of steps over one scene. The scene's nodes and edges are declared once; each
// step says which of them are visible and in what state, so the diagram changes from step to step instead of being
// redrawn. Prose fields accept a small inline syntax (see lesson-inline.ts), never raw HTML.
//
// Ported from rho's lesson schema (src/lib/lesson-schema.ts) so a rho lesson JSON drops into a module unchanged. The
// site-only fields (topic, publishedAt, draft) are accepted and ignored here.

const id = z.string().regex(/^[a-z][a-z0-9-]*$/, "ids are lowercase kebab-case");
const prose = z.string().min(1);

export const chapters = ["setup", "problem", "technique", "solution", "tradeoff", "insight", "recap"] as const;
export const nodeStates = ["idle", "active", "ok", "fail", "muted"] as const;

const node = z.object({
	id,
	label: z.string().min(1).max(18),
	sublabel: z.string().max(22).optional(),
	x: z.number().min(0).max(100),
	y: z.number().min(0).max(100),
});

const edge = z.object({ id, from: id, to: id, label: z.string().max(16).optional(), bend: z.number().min(-40).max(40).default(0) });

const option = z.object({ id, text: prose, misconception: z.string().optional() });

const question = z.object({
	prompt: prose,
	options: z.array(option).min(2).max(5),
	answer: id,
	explanation: prose,
});

const metric = z.object({ id, label: z.string().min(1), unit: z.string().default(""), better: z.enum(["lower", "higher"]) });

const step = z.object({
	id,
	chapter: z.enum(chapters),
	short: z.string().min(1).max(22),
	title: z.string().min(1),
	body: z.array(prose).min(1).max(4),
	callout: z.object({ kind: z.enum(["tip", "warn"]), text: prose }).optional(),
	changes: z.array(z.string().regex(/^[+~-] /, 'changes start with "+ ", "~ " or "- "')).default([]),
	metrics: z.record(z.string(), z.union([z.number(), z.string()])).default({}),
	scene: z.object({
		show: z.array(id).min(1),
		states: z.record(z.string(), z.enum(nodeStates)).default({}),
		flows: z.array(z.object({ edge: id, tone: z.enum(["signal", "fail"]).default("signal") })).default([]),
		notes: z.record(z.string(), z.string().max(28)).default({}),
	}),
	predict: question.optional(),
	narration: z.string().optional(),
});

export const lessonSchema = z
	.object({
		title: z.string().min(1),
		description: z.string().min(1),
		topic: z.string().optional(),
		publishedAt: z.string().optional(),
		draft: z.boolean().optional(),
		duration: z.string(),
		scene: z.object({ label: z.string().min(1), nodes: z.array(node).min(1), edges: z.array(edge).default([]) }),
		metrics: z.array(metric).max(4).default([]),
		steps: z.array(step).min(2),
		check: z.array(question.extend({ id, reviewStep: id })).min(1).max(6),
	})
	.superRefine((lesson, ctx) => {
		const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: "custom", path, message });
		const unique = (ids: string[], path: (string | number)[], what: string) => {
			const seen = new Set<string>();
			ids.forEach((value, index) => {
				if (seen.has(value)) issue([...path, index], `duplicate ${what} id "${value}"`);
				seen.add(value);
			});
		};
		const nodes = new Set(lesson.scene.nodes.map((n) => n.id));
		const edges = new Map(lesson.scene.edges.map((e) => [e.id, e]));
		const metrics = new Set(lesson.metrics.map((m) => m.id));
		const steps = new Set(lesson.steps.map((s) => s.id));
		unique(lesson.scene.nodes.map((n) => n.id), ["scene", "nodes"], "node");
		unique(lesson.scene.edges.map((e) => e.id), ["scene", "edges"], "edge");
		unique(lesson.steps.map((s) => s.id), ["steps"], "step");
		unique(lesson.check.map((q) => q.id), ["check"], "question");
		lesson.scene.edges.forEach((e, i) => {
			for (const end of ["from", "to"] as const) if (!nodes.has(e[end])) issue(["scene", "edges", i, end], `unknown node "${e[end]}"`);
		});
		const answerable = (q: z.infer<typeof question>, path: (string | number)[]) => {
			if (!q.options.some((o) => o.id === q.answer)) issue([...path, "answer"], `answer "${q.answer}" is not one of the options`);
			unique(q.options.map((o) => o.id), [...path, "options"], "option");
		};
		lesson.steps.forEach((s, i) => {
			const shown = new Set(s.scene.show);
			s.scene.show.forEach((n, j) => {
				if (!nodes.has(n)) issue(["steps", i, "scene", "show", j], `unknown node "${n}"`);
			});
			for (const key of [...Object.keys(s.scene.states), ...Object.keys(s.scene.notes)]) {
				if (!shown.has(key)) issue(["steps", i, "scene"], `"${key}" has a state or note but is not shown`);
			}
			s.scene.flows.forEach((f, j) => {
				const e = edges.get(f.edge);
				if (!e) issue(["steps", i, "scene", "flows", j], `unknown edge "${f.edge}"`);
				else if (!shown.has(e.from) || !shown.has(e.to)) issue(["steps", i, "scene", "flows", j], `edge "${f.edge}" connects a node that is not shown`);
			});
			for (const key of Object.keys(s.metrics)) if (!metrics.has(key)) issue(["steps", i, "metrics", key], `unknown metric "${key}"`);
			if (s.predict) answerable(s.predict, ["steps", i, "predict"]);
		});
		lesson.check.forEach((q, i) => {
			answerable(q, ["check", i]);
			if (!steps.has(q.reviewStep)) issue(["check", i, "reviewStep"], `unknown step "${q.reviewStep}"`);
		});
	});

export type Lesson = z.infer<typeof lessonSchema>;
export type LessonStep = Lesson["steps"][number];
export type LessonQuestion = NonNullable<LessonStep["predict"]>;
export type CheckQuestion = Lesson["check"][number];
