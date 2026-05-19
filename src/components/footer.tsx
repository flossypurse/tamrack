import Link from "next/link";
import { Wordmark } from "./brand/wordmark";

export function Footer() {
  return (
    <footer className="border-t border-[var(--hairline)] mt-8">
      <div className="max-w-6xl mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-[var(--mid)]">
          <Wordmark height={14} />
          <span className="font-mono text-[10px] tracking-[0.14em] uppercase">
            &copy; {new Date().getFullYear()}
          </span>
        </div>
        <div className="flex items-center gap-5 font-mono text-[10px] tracking-[0.14em] uppercase text-[var(--mid)]">
          <Link
            href="/privacy"
            className="hover:text-[var(--amber)] transition-colors"
            style={{ transitionDuration: "var(--dur-instant)" }}
          >
            Privacy
          </Link>
          <Link
            href="/terms"
            className="hover:text-[var(--amber)] transition-colors"
            style={{ transitionDuration: "var(--dur-instant)" }}
          >
            Terms
          </Link>
          <a
            href="mailto:hello@tamrack.ca"
            className="hover:text-[var(--amber)] transition-colors"
            style={{ transitionDuration: "var(--dur-instant)" }}
          >
            Contact
          </a>
        </div>
      </div>
    </footer>
  );
}
