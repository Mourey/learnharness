import { ModuleLibrary } from "@/components/module-library";
import { isDesktopServer, listModules } from "@/src/server";

// Dynamic: the library reflects the modules folder and which videos are
// rendered on this machine, re-read on every navigation.
export const dynamic = "force-dynamic";

export default function ModulesPage() {
	return <ModuleLibrary modules={listModules()} packaged={isDesktopServer()} />;
}
