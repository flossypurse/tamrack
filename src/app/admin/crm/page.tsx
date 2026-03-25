"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardHeader } from "@/components/card";
import { PageHeader } from "@/components/page-header";
import { AdminNav } from "../admin-nav";
import {
  UserPlus,
  Search,
  Mail,
  Phone,
  Building2,
  MapPin,
  MessageSquare,
  Trash2,
  ChevronDown,
  ChevronUp,
  Send,
  X,
  Sparkles,
  Loader2,
} from "lucide-react";

// ============================================================
// Types
// ============================================================

interface Contact {
  id: number;
  name: string;
  email: string;
  phone: string;
  organization: string;
  role: string;
  municipality: string;
  status: string;
  source: string;
  notes: string;
  created_at: string;
  updated_at: string;
  last_activity: string | null;
  last_activity_at: string | null;
}

interface Activity {
  id: number;
  contact_id: number;
  type: string;
  content: string;
  created_at: string;
}

interface PipelineCount {
  status: string;
  count: number;
}

const STATUSES = ["lead", "contacted", "replied", "demo", "converted", "dead"] as const;

const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  lead: { bg: "bg-blue-500/10", text: "text-blue-400", dot: "bg-blue-500" },
  contacted: { bg: "bg-amber-500/10", text: "text-amber-400", dot: "bg-amber-500" },
  replied: { bg: "bg-purple-500/10", text: "text-purple-400", dot: "bg-purple-500" },
  demo: { bg: "bg-cyan-500/10", text: "text-cyan-400", dot: "bg-cyan-500" },
  converted: { bg: "bg-emerald-500/10", text: "text-emerald-400", dot: "bg-emerald-500" },
  dead: { bg: "bg-neutral-500/10", text: "text-neutral-400", dot: "bg-neutral-500" },
};

const ACTIVITY_TYPES = ["note", "email", "call", "meeting", "demo"] as const;

const EMPTY_FORM = {
  name: "",
  email: "",
  phone: "",
  organization: "",
  role: "",
  municipality: "",
  status: "lead",
  source: "",
  notes: "",
};

interface EmailDraft {
  contactId: number;
  to: string;
  name: string;
  subject: string;
  body: string;
}

// ============================================================
// Page
// ============================================================

export default function CRMPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [pipeline, setPipeline] = useState<PipelineCount[]>([]);
  const [filter, setFilter] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [newActivity, setNewActivity] = useState("");
  const [newActivityType, setNewActivityType] = useState<string>("note");
  const [loading, setLoading] = useState(true);
  const [emailDraft, setEmailDraft] = useState<EmailDraft | null>(null);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [generatingEmail, setGeneratingEmail] = useState(false);

  const fetchContacts = useCallback(async () => {
    const params = new URLSearchParams();
    if (filter) params.set("status", filter);
    if (search) params.set("q", search);
    const res = await fetch(`/api/admin/crm?${params}`);
    const data = await res.json();
    setContacts(data.contacts);
    setPipeline(data.pipeline);
    setLoading(false);
  }, [filter, search]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  const fetchActivities = async (contactId: number) => {
    const res = await fetch(`/api/admin/crm/activities?contact_id=${contactId}`);
    const data = await res.json();
    setActivities(data);
  };

  const handleExpand = async (id: number) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    await fetchActivities(id);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) return;

    if (editingId) {
      await fetch("/api/admin/crm", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingId, ...form }),
      });
    } else {
      await fetch("/api/admin/crm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
    }

    setForm(EMPTY_FORM);
    setShowForm(false);
    setEditingId(null);
    await fetchContacts();
  };

  const handleEdit = (c: Contact) => {
    setForm({
      name: c.name,
      email: c.email,
      phone: c.phone,
      organization: c.organization,
      role: c.role,
      municipality: c.municipality,
      status: c.status,
      source: c.source,
      notes: c.notes,
    });
    setEditingId(c.id);
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    await fetch(`/api/admin/crm?id=${id}`, { method: "DELETE" });
    if (expandedId === id) setExpandedId(null);
    await fetchContacts();
  };

  const handleStatusChange = async (id: number, status: string) => {
    await fetch("/api/admin/crm", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    await fetchContacts();
  };

  const handleAddActivity = async (contactId: number) => {
    if (!newActivity.trim()) return;
    await fetch("/api/admin/crm/activities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contact_id: contactId,
        type: newActivityType,
        content: newActivity,
      }),
    });
    setNewActivity("");
    setNewActivityType("note");
    await fetchActivities(contactId);
    await fetchContacts();
  };

  const handleSendEmail = async () => {
    if (!emailDraft || !emailDraft.subject.trim() || !emailDraft.body.trim()) return;
    setSendingEmail(true);
    setEmailStatus(null);
    try {
      const res = await fetch("/api/admin/crm/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact_id: emailDraft.contactId,
          to: emailDraft.to,
          subject: emailDraft.subject,
          body: emailDraft.body,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setEmailStatus({ type: "success", message: `Sent to ${emailDraft.to}` });
      // Auto-update status to "contacted" if currently "lead"
      const contact = contacts.find((c) => c.id === emailDraft.contactId);
      if (contact?.status === "lead") {
        await handleStatusChange(contact.id, "contacted");
      }
      if (expandedId === emailDraft.contactId) {
        await fetchActivities(emailDraft.contactId);
      }
      await fetchContacts();
      setTimeout(() => {
        setEmailDraft(null);
        setEmailStatus(null);
      }, 1500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to send";
      setEmailStatus({ type: "error", message: msg });
    } finally {
      setSendingEmail(false);
    }
  };

  const openEmailCompose = (c: Contact) => {
    setEmailDraft({
      contactId: c.id,
      to: c.email,
      name: c.name,
      subject: "",
      body: "",
    });
    setEmailStatus(null);
  };

  const handleGenerateEmail = async () => {
    if (!emailDraft) return;
    setGeneratingEmail(true);
    setEmailStatus(null);
    try {
      const res = await fetch("/api/admin/crm/generate-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact_id: emailDraft.contactId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setEmailDraft({
        ...emailDraft,
        subject: data.subject,
        body: data.body,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to generate";
      setEmailStatus({ type: "error", message: msg });
    } finally {
      setGeneratingEmail(false);
    }
  };

  const totalContacts = pipeline.reduce((s, p) => s + p.count, 0);

  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="CRM"
        description="Track outreach to potential users and partners"
        category="tools"
      />

      <AdminNav />

      {/* Pipeline Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <button
          onClick={() => setFilter("")}
          className={`px-3 py-2.5 rounded-lg text-left transition-colors ${
            !filter ? "bg-accent/10 ring-1 ring-accent/30" : "bg-card border border-card-border hover:bg-foreground/[0.03]"
          }`}
        >
          <p className="text-lg font-bold">{totalContacts}</p>
          <p className="text-[11px] text-muted">All</p>
        </button>
        {STATUSES.map((s) => {
          const count = pipeline.find((p) => p.status === s)?.count ?? 0;
          const colors = STATUS_COLORS[s];
          return (
            <button
              key={s}
              onClick={() => setFilter(filter === s ? "" : s)}
              className={`px-3 py-2.5 rounded-lg text-left transition-colors ${
                filter === s
                  ? `${colors.bg} ring-1 ring-current ${colors.text}`
                  : "bg-card border border-card-border hover:bg-foreground/[0.03]"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${colors.dot}`} />
                <p className="text-lg font-bold">{count}</p>
              </div>
              <p className="text-[11px] text-muted capitalize">{s}</p>
            </button>
          );
        })}
      </div>

      {/* Search + Add */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="Search contacts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-card border border-card-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent/50"
          />
        </div>
        <button
          onClick={() => {
            setForm(EMPTY_FORM);
            setEditingId(null);
            setShowForm(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors"
        >
          <UserPlus size={14} />
          Add Contact
        </button>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <Card>
          <CardHeader
            title={editingId ? "Edit Contact" : "New Contact"}
            subtitle="Fill in what you know — everything except name is optional"
          />
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
            <input
              placeholder="Name *"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="px-3 py-2 bg-background border border-card-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent/50"
            />
            <input
              placeholder="Email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="px-3 py-2 bg-background border border-card-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent/50"
            />
            <input
              placeholder="Phone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="px-3 py-2 bg-background border border-card-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent/50"
            />
            <input
              placeholder="Organization"
              value={form.organization}
              onChange={(e) => setForm({ ...form, organization: e.target.value })}
              className="px-3 py-2 bg-background border border-card-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent/50"
            />
            <input
              placeholder="Role (e.g. EDO, Realtor, Developer)"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="px-3 py-2 bg-background border border-card-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent/50"
            />
            <input
              placeholder="Municipality"
              value={form.municipality}
              onChange={(e) => setForm({ ...form, municipality: e.target.value })}
              className="px-3 py-2 bg-background border border-card-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent/50"
            />
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="px-3 py-2 bg-background border border-card-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent/50"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
            <input
              placeholder="Source (e.g. LinkedIn, town website, Reddit)"
              value={form.source}
              onChange={(e) => setForm({ ...form, source: e.target.value })}
              className="px-3 py-2 bg-background border border-card-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent/50"
            />
          </div>
          <textarea
            placeholder="Notes..."
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            rows={2}
            className="w-full mt-3 px-3 py-2 bg-background border border-card-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent/50 resize-none"
          />
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleSubmit}
              disabled={!form.name.trim()}
              className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-40"
            >
              {editingId ? "Save Changes" : "Add Contact"}
            </button>
            <button
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
                setForm(EMPTY_FORM);
              }}
              className="px-4 py-2 text-muted hover:text-foreground rounded-lg text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </Card>
      )}

      {/* Contacts List */}
      {loading ? (
        <p className="text-sm text-muted text-center py-12">Loading...</p>
      ) : contacts.length === 0 ? (
        <Card>
          <div className="py-12 text-center">
            <UserPlus size={32} className="mx-auto text-muted mb-3" />
            <p className="text-muted">
              {filter || search ? "No contacts match your filter" : "No contacts yet. Add your first lead above."}
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-2">
          {contacts.map((c) => (
            <div key={c.id} className="bg-card border border-card-border rounded-xl overflow-hidden">
              {/* Contact Row */}
              <div className="flex items-center gap-3 px-4 py-3">
                <button
                  onClick={() => handleExpand(c.id)}
                  className="text-muted hover:text-foreground transition-colors"
                >
                  {expandedId === c.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">{c.name}</span>
                    {c.organization && (
                      <span className="text-xs text-muted flex items-center gap-1">
                        <Building2 size={10} /> {c.organization}
                      </span>
                    )}
                    {c.municipality && (
                      <span className="text-xs text-muted flex items-center gap-1">
                        <MapPin size={10} /> {c.municipality}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    {c.email && (
                      <span className="text-[11px] text-muted flex items-center gap-1">
                        <Mail size={9} /> {c.email}
                      </span>
                    )}
                    {c.phone && (
                      <span className="text-[11px] text-muted flex items-center gap-1">
                        <Phone size={9} /> {c.phone}
                      </span>
                    )}
                    {c.role && <span className="text-[11px] text-muted">{c.role}</span>}
                    {c.last_activity && (
                      <span className="text-[11px] text-muted/50 flex items-center gap-1 ml-auto">
                        <MessageSquare size={9} />
                        {c.last_activity.length > 60 ? c.last_activity.slice(0, 60) + "..." : c.last_activity}
                      </span>
                    )}
                  </div>
                </div>

                {/* Status dropdown */}
                <select
                  value={c.status}
                  onChange={(e) => handleStatusChange(c.id, e.target.value)}
                  className={`text-[11px] px-2 py-1 rounded-md border-0 cursor-pointer font-medium ${
                    STATUS_COLORS[c.status]?.bg ?? ""
                  } ${STATUS_COLORS[c.status]?.text ?? ""}`}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </option>
                  ))}
                </select>

                {c.email && (
                  <button
                    onClick={() => openEmailCompose(c)}
                    className="text-muted hover:text-blue-400 transition-colors"
                    title="Send email"
                  >
                    <Send size={13} />
                  </button>
                )}
                <button
                  onClick={() => handleEdit(c)}
                  className="text-[11px] text-muted hover:text-foreground px-2 py-1 rounded transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(c.id)}
                  className="text-muted hover:text-red-400 transition-colors"
                >
                  <Trash2 size={13} />
                </button>
              </div>

              {/* Expanded: Activity Timeline */}
              {expandedId === c.id && (
                <div className="border-t border-card-border px-4 py-3 bg-background/30">
                  {c.notes && (
                    <p className="text-xs text-muted mb-3 italic">{c.notes}</p>
                  )}

                  {/* Add Activity */}
                  <div className="flex gap-2 mb-3">
                    <select
                      value={newActivityType}
                      onChange={(e) => setNewActivityType(e.target.value)}
                      className="px-2 py-1.5 bg-background border border-card-border rounded-lg text-xs"
                    >
                      {ACTIVITY_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t.charAt(0).toUpperCase() + t.slice(1)}
                        </option>
                      ))}
                    </select>
                    <input
                      placeholder="Add a note, log an email, record a call..."
                      value={newActivity}
                      onChange={(e) => setNewActivity(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAddActivity(c.id)}
                      className="flex-1 px-3 py-1.5 bg-background border border-card-border rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-accent/50"
                    />
                    <button
                      onClick={() => handleAddActivity(c.id)}
                      disabled={!newActivity.trim()}
                      className="px-3 py-1.5 bg-accent text-white rounded-lg text-xs hover:bg-accent/90 disabled:opacity-40 transition-colors"
                    >
                      <Send size={12} />
                    </button>
                  </div>

                  {/* Timeline */}
                  {activities.length > 0 ? (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {activities.map((a) => (
                        <div key={a.id} className="flex gap-2 text-xs">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            a.type === "email" ? "bg-blue-500/10 text-blue-400" :
                            a.type === "call" ? "bg-green-500/10 text-green-400" :
                            a.type === "meeting" ? "bg-purple-500/10 text-purple-400" :
                            a.type === "demo" ? "bg-cyan-500/10 text-cyan-400" :
                            "bg-foreground/5 text-muted"
                          }`}>
                            {a.type}
                          </span>
                          <span className="text-foreground/80 flex-1">{a.content}</span>
                          <span className="text-muted/50 whitespace-nowrap">
                            {new Date(a.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-muted/50 text-center py-2">No activity yet</p>
                  )}

                  {c.source && (
                    <p className="text-[10px] text-muted/40 mt-2">
                      Source: {c.source} &middot; Added {new Date(c.created_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Email Compose Modal */}
      {emailDraft && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-card-border rounded-xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-card-border">
              <div className="flex items-center gap-2">
                <Mail size={14} className="text-blue-400" />
                <span className="text-sm font-medium">Email {emailDraft.name}</span>
              </div>
              <button
                onClick={() => { setEmailDraft(null); setEmailStatus(null); }}
                className="text-muted hover:text-foreground transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="text-xs text-muted">
                From: <span className="text-foreground">cullywakelin@gmail.com</span>
              </div>
              <div className="text-xs text-muted">
                To: <span className="text-foreground">{emailDraft.to}</span>
              </div>
              <button
                onClick={handleGenerateEmail}
                disabled={generatingEmail}
                className="flex items-center gap-2 px-3 py-2 bg-purple-600/10 text-purple-400 border border-purple-500/20 rounded-lg text-xs font-medium hover:bg-purple-600/20 transition-colors disabled:opacity-50 w-full justify-center"
              >
                {generatingEmail ? (
                  <><Loader2 size={12} className="animate-spin" /> Generating...</>
                ) : (
                  <><Sparkles size={12} /> Generate Message</>
                )}
              </button>
              <input
                placeholder="Subject"
                value={emailDraft.subject}
                onChange={(e) => setEmailDraft({ ...emailDraft, subject: e.target.value })}
                className="w-full px-3 py-2 bg-background border border-card-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent/50"
                autoFocus
              />
              <textarea
                placeholder="Write your message..."
                value={emailDraft.body}
                onChange={(e) => setEmailDraft({ ...emailDraft, body: e.target.value })}
                rows={8}
                className="w-full px-3 py-2 bg-background border border-card-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent/50 resize-none"
              />
              {emailStatus && (
                <div className={`text-xs px-3 py-2 rounded-lg ${
                  emailStatus.type === "success"
                    ? "bg-emerald-500/10 text-emerald-400"
                    : "bg-red-500/10 text-red-400"
                }`}>
                  {emailStatus.message}
                </div>
              )}
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => { setEmailDraft(null); setEmailStatus(null); }}
                  className="px-4 py-2 text-muted hover:text-foreground rounded-lg text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSendEmail}
                  disabled={sendingEmail || !emailDraft.subject.trim() || !emailDraft.body.trim()}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-500 transition-colors disabled:opacity-40"
                >
                  <Send size={12} />
                  {sendingEmail ? "Sending..." : "Send Email"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
