import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Bell } from "lucide-react";
import AlertsClient from "./alerts-client";

export default async function EdoAlertsPage() {
  const session = await auth();
  if (!session?.user?.municipalityId) redirect("/edo/onboarding");

  const municipalitySlug = session.user.municipalityId;
  const municipalityName = municipalitySlug
    .split("-")
    .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  return (
    <main className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-indigo-400">
          <Bell size={20} />
          <span className="text-xs font-mono uppercase tracking-wider">
            Trend Alerts
          </span>
        </div>
        <h1 className="text-2xl font-bold">Alerts — {municipalityName}</h1>
        <p className="text-muted text-sm">
          Monitoring key indicators for significant changes. Alerts are evaluated
          against the latest available data.
        </p>
      </div>

      <AlertsClient municipalitySlug={municipalitySlug} />
    </main>
  );
}
