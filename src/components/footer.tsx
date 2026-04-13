import Link from "next/link";
import { Activity } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-card-border mt-8">
      <div className="max-w-6xl mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted/50">
        <div className="flex items-center gap-2">
          <Activity size={14} className="text-accent" />
          <span>&copy; {new Date().getFullYear()} Alberta Pulse Check</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
          <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
          <a href="mailto:hello@albertapulsecheck.ca" className="hover:text-foreground transition-colors">Contact</a>
        </div>
      </div>
    </footer>
  );
}
