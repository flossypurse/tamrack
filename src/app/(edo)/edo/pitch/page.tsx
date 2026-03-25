import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Presentation } from "lucide-react";
import { getComparableMunicipalities } from "@/lib/edo/compare";
import { getMunicipality } from "@/lib/municipality-registry";
import PitchClient from "./pitch-client";

export default async function EdoPitchPage() {
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
          <Presentation size={20} />
          <span className="text-xs font-mono uppercase tracking-wider">Investment Pitch Kit</span>
        </div>
        <h1 className="text-2xl font-bold">Pitch Kit</h1>
        <p className="text-muted text-sm">
          Create investor-facing presentations from your municipality data.
        </p>
      </div>

      <PitchClient
        municipalitySlug={municipalitySlug}
        municipalityName={municipalityName}
        allMunicipalities={allMunicipalities}
      />
    </main>
  );
}
