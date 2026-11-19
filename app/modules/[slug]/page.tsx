import "@/components/lesson/lesson.css";
import { notFound } from "next/navigation";
import { ModuleView } from "@/components/module-view";
import { isDesktopServer, moduleSummary, readModuleLesson } from "@/src/server";

export const dynamic = "force-dynamic";

export default async function ModulePage({ params }: { params: Promise<{ slug: string }> }) {
	const { slug } = await params;
	const summary = moduleSummary(slug);
	if (!summary) notFound();
	return <ModuleView module={summary} lesson={readModuleLesson(slug)} packaged={isDesktopServer()} />;
}
