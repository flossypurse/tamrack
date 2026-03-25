import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { FileText } from "lucide-react";
import { getComparableMunicipalities } from "@/lib/edo/compare";
import { getMunicipality } from "@/lib/municipality-registry";
import ReportsClient from "./reports-client";

export default async function EdoReportsPage() {
  const session = await auth();
  if (!session?.user?.municipalityId) redirect("/edo/onboarding");

  const municipalitySlug = session.user.municipalityId;
  const config = getMunicipality(municipalitySlug);
  const municipalityName = config?.name ?? municipalitySlug
    .split("-")
    .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  const allMunicipalities = getComparableMunicipalities();

  return (
    <main className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-indigo-400">
          <FileText size={20} />
          <span className="text-xs font-mono uppercase tracking-wider">Council Reports</span>
        </div>
        <h1 className="text-2xl font-bold">Reports</h1>
        <p className="text-muted text-sm">
          Generate presentation-ready reports for council meetings.
        </p>
      </div>

      <ReportsClient
        municipalitySlug={municipalitySlug}
        municipalityName={municipalityName}
        allMunicipalities={allMunicipalities}
      />
    </main>
  );
}
