import "@/app/globals.css";
import { EmbedResize } from "@/components/embed-resize";

// Embed layout — no nav, no shell, minimal chrome for iframe embedding
export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-card min-h-screen">
      <EmbedResize />
      {children}
    </div>
  );
}
