import { Settings } from "lucide-react";

export default function EdoSettingsPage() {
  return (
    <main className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-indigo-400">
          <Settings size={20} />
          <span className="text-xs font-mono uppercase tracking-wider">Settings</span>
        </div>
        <h1 className="text-2xl font-bold">EDO Settings</h1>
        <p className="text-muted text-sm">
          Manage your EDO subscription and preferences.
        </p>
      </div>

      <div className="bg-card border border-card-border rounded-xl p-8 text-center space-y-3">
        <Settings size={32} className="mx-auto text-indigo-400/30" />
        <h2 className="font-semibold">Settings coming soon</h2>
        <p className="text-sm text-muted max-w-md mx-auto">
          Configure your municipality selection, notification preferences, and billing details.
        </p>
      </div>
    </main>
  );
}
