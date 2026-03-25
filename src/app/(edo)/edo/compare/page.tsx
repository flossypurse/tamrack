import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getComparableMunicipalities } from "@/lib/edo/compare";
import { CompareClient } from "./compare-client";

export default async function EdoComparePage() {
  const session = await auth();
  if (!session?.user?.municipalityId) redirect("/edo/onboarding");

  const allMunicipalities = getComparableMunicipalities();
  const boundMunicipality = session.user.municipalityId;

  return (
    <main className="p-4 sm:p-6 max-w-6xl mx-auto">
      <CompareClient
        boundMunicipality={boundMunicipality}
        allMunicipalities={allMunicipalities}
      />
    </main>
  );
}
