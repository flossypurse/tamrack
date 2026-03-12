import "@/app/globals.css";

// Embed layout — no nav, no shell, minimal chrome for iframe embedding
export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-card min-h-screen">
      {children}
    </div>
  );
}
