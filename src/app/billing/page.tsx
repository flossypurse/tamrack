"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { CreditCard, Key, Loader2, Copy, Check, Trash2, Plus, ExternalLink } from "lucide-react";

interface ApiKeyRow {
  id: string;
  key_prefix: string;
  name: string;
  last_used_at: string | null;
  created_at: string;
  revoked_at: string | null;
}

export default function BillingPage() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState("");
  const [apiKeys, setApiKeys] = useState<ApiKeyRow[]>([]);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [keyName, setKeyName] = useState("");

  const sub = session?.user;
  const isActive = sub?.subscriptionStatus === "active";
  const isTrialing = sub?.subscriptionStatus === "trialing";
  const trialEnd = sub?.trialEnd ? new Date(sub.trialEnd) : null;
  const daysLeft = trialEnd ? Math.max(0, Math.ceil((trialEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : 0;

  useEffect(() => {
    fetchApiKeys();
  }, []);

  async function fetchApiKeys() {
    const res = await fetch("/api/api-keys");
    if (res.ok) {
      const data = await res.json();
      setApiKeys(data.keys);
    }
  }

  async function handleCheckout() {
    setLoading("checkout");
    const res = await fetch("/api/billing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "checkout" }),
    });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
    setLoading("");
  }

  async function handlePortal() {
    setLoading("portal");
    const res = await fetch("/api/billing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "portal" }),
    });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
    setLoading("");
  }

  async function handleCreateKey() {
    setLoading("key");
    const res = await fetch("/api/api-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: keyName || "Default" }),
    });
    const data = await res.json();
    if (data.key) {
      setNewKey(data.key);
      setKeyName("");
      fetchApiKeys();
    }
    setLoading("");
  }

  async function handleRevokeKey(keyId: string) {
    const res = await fetch("/api/api-keys", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyId }),
    });
    if (res.ok) fetchApiKeys();
  }

  function copyKey() {
    if (newKey) {
      navigator.clipboard.writeText(newKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
      <h1 className="text-xl font-bold">Billing & API Keys</h1>

      {/* Subscription Status */}
      <div className="bg-card border border-card-border rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <CreditCard size={18} className="text-accent" />
          <h2 className="font-semibold">Subscription</h2>
        </div>

        <div className="flex items-center gap-3">
          <span
            className={`px-2 py-0.5 rounded text-xs font-medium ${
              isActive
                ? "bg-accent-green/10 text-accent-green"
                : isTrialing
                ? "bg-accent-amber/10 text-accent-amber"
                : "bg-accent-red/10 text-accent-red"
            }`}
          >
            {isActive ? "Active" : isTrialing ? "Trial" : sub?.subscriptionStatus ?? "No subscription"}
          </span>
          {isTrialing && (
            <span className="text-sm text-muted">
              {daysLeft} day{daysLeft !== 1 ? "s" : ""} remaining
            </span>
          )}
          {isActive && sub?.cancelAtPeriodEnd && (
            <span className="text-sm text-accent-amber">Cancels at period end</span>
          )}
        </div>

        <p className="text-sm text-muted">
          Alberta Pulse Pro — <span className="text-foreground font-medium">$29/mo CAD</span>
          <br />
          Full access to all dashboards, municipality data, and API.
        </p>

        <div className="flex gap-3">
          {!isActive && (
            <button
              onClick={handleCheckout}
              disabled={!!loading}
              className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg font-medium hover:bg-accent/90 disabled:opacity-50 transition-colors"
            >
              {loading === "checkout" ? <Loader2 size={14} className="animate-spin" /> : <CreditCard size={14} />}
              Subscribe — $29/mo
            </button>
          )}
          {(isActive || sub?.subscriptionStatus === "past_due") && (
            <button
              onClick={handlePortal}
              disabled={!!loading}
              className="flex items-center gap-2 px-4 py-2 border border-card-border rounded-lg text-foreground hover:bg-card transition-colors"
            >
              {loading === "portal" ? <Loader2 size={14} className="animate-spin" /> : <ExternalLink size={14} />}
              Manage billing
            </button>
          )}
        </div>
      </div>

      {/* API Keys */}
      <div className="bg-card border border-card-border rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Key size={18} className="text-accent" />
          <h2 className="font-semibold">API Keys</h2>
        </div>

        <p className="text-sm text-muted">
          Use API keys to access <code className="text-xs bg-card-border/50 px-1 py-0.5 rounded">/api/permits</code>,{" "}
          <code className="text-xs bg-card-border/50 px-1 py-0.5 rounded">/api/assessments</code>, and other endpoints programmatically.
          <br />
          Rate limit: 1,000 requests/day per key.
        </p>

        {/* New key alert */}
        {newKey && (
          <div className="bg-accent-green/5 border border-accent-green/20 rounded-lg p-4 space-y-2">
            <p className="text-sm font-medium text-accent-green">New API key created — copy it now, it won&apos;t be shown again.</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-background/50 px-3 py-2 rounded font-mono break-all">{newKey}</code>
              <button onClick={copyKey} className="p-2 hover:bg-card-border/50 rounded transition-colors">
                {copied ? <Check size={14} className="text-accent-green" /> : <Copy size={14} className="text-muted" />}
              </button>
            </div>
            <button onClick={() => setNewKey(null)} className="text-xs text-muted hover:text-foreground">
              Dismiss
            </button>
          </div>
        )}

        {/* Create key */}
        <div className="flex gap-2">
          <input
            type="text"
            value={keyName}
            onChange={(e) => setKeyName(e.target.value)}
            placeholder="Key name (optional)"
            className="flex-1 px-3 py-2 bg-background border border-card-border rounded-lg text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-accent/50"
          />
          <button
            onClick={handleCreateKey}
            disabled={!!loading}
            className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90 disabled:opacity-50 transition-colors"
          >
            {loading === "key" ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Create key
          </button>
        </div>

        {/* Key list */}
        {apiKeys.length > 0 && (
          <div className="space-y-2">
            {apiKeys.map((k) => (
              <div
                key={k.id}
                className={`flex items-center justify-between px-3 py-2 border border-card-border rounded-lg text-sm ${
                  k.revoked_at ? "opacity-40" : ""
                }`}
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <code className="text-xs font-mono text-muted">{k.key_prefix}...</code>
                    <span className="text-foreground">{k.name}</span>
                    {k.revoked_at && (
                      <span className="text-[10px] bg-accent-red/10 text-accent-red px-1.5 py-0.5 rounded">Revoked</span>
                    )}
                  </div>
                  <div className="text-[11px] text-muted/60">
                    Created {new Date(k.created_at).toLocaleDateString()}
                    {k.last_used_at && ` · Last used ${new Date(k.last_used_at).toLocaleDateString()}`}
                  </div>
                </div>
                {!k.revoked_at && (
                  <button
                    onClick={() => handleRevokeKey(k.id)}
                    className="p-1.5 text-muted hover:text-accent-red transition-colors"
                    title="Revoke key"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
