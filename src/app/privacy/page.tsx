import type { Metadata } from "next";
import Link from "next/link";
import { Activity } from "lucide-react";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Privacy Policy for Tamrack. We respect your data privacy under PIPEDA and Alberta PIPA.",
};

const LAST_UPDATED = "May 2026";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-2 mb-8">
        <Link href="/" className="flex items-center gap-2 text-muted hover:text-foreground transition-colors">
          <Activity size={18} className="text-accent" />
          <span className="text-sm font-semibold">Tamrack</span>
        </Link>
      </div>

      <article className="prose prose-invert prose-sm max-w-none space-y-6 text-muted [&_h1]:text-foreground [&_h2]:text-foreground [&_h3]:text-foreground [&_strong]:text-foreground">
        <h1 className="text-2xl font-bold text-foreground">Privacy Policy</h1>
        <p className="text-xs text-muted/60">Last updated: {LAST_UPDATED}</p>

        <h2 className="text-lg font-semibold">1. Information We Collect</h2>

        <h3 className="text-base font-medium">Account Information</h3>
        <p>
          When you create an account, we collect your email address. If you sign in with Google, we also receive
          your name and profile image from Google. We store a Google OAuth token solely to verify your identity
          on subsequent sign-ins — we do not use it to access any other Google services. We do not collect
          passwords — authentication is handled via magic links or OAuth.
        </p>

        <h3 className="text-base font-medium">Billing Information</h3>
        <p>
          Payment information is collected and processed entirely by Stripe. We do not store credit card numbers,
          bank account details, or other payment credentials. We receive a Stripe customer ID and subscription
          status.
        </p>

        <h3 className="text-base font-medium">Usage Data</h3>
        <p>
          We log API requests (endpoint, timestamp, response status) for rate limiting and service monitoring.
          We do not track browsing behavior or share data with advertising platforms.
        </p>

        <h3 className="text-base font-medium">Analytics</h3>
        <p>
          We may use Google Analytics 4 to understand how the Service is used (e.g. sign-up conversions, page
          views). When enabled, Google Analytics sets its own cookies and collects anonymized usage data such as
          pages visited, session duration, and browser type. This data is processed by Google under
          its <a href="https://policies.google.com/privacy" className="text-accent hover:underline" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.
          Google Analytics is not used for advertising or cross-site tracking. You can opt out of Google Analytics
          by installing the <a href="https://tools.google.com/dlpage/gaoptout" className="text-accent hover:underline" target="_blank" rel="noopener noreferrer">Google Analytics Opt-out Browser Add-on</a>.
        </p>

        <h2 className="text-lg font-semibold">2. How We Use Your Information</h2>
        <ul className="list-disc pl-6 space-y-1">
          <li>To provide and maintain the Service</li>
          <li>To send magic link sign-in emails</li>
          <li>To process subscription billing through Stripe</li>
          <li>To enforce API rate limits</li>
          <li>To understand usage patterns and improve the Service (via analytics)</li>
          <li>To communicate service updates (rare, opt-out available)</li>
        </ul>

        <h2 className="text-lg font-semibold">3. Data Storage</h2>
        <p>
          Account and subscription data is stored in a PostgreSQL database hosted on Crunchy Bridge
          (Canada — ca-central-1 / Montreal region). Application servers run on Fly.io (Canada — yyz / Toronto region).
          All data is transmitted over HTTPS. API keys are stored as SHA-256 hashes — we cannot recover your API
          key after creation.
        </p>

        <h2 className="text-lg font-semibold">4. Data Sharing</h2>
        <p>
          We do not sell, rent, or share your personal information with third parties, except:
        </p>
        <ul className="list-disc pl-6 space-y-1">
          <li><strong>Stripe</strong> — for payment processing</li>
          <li><strong>Mailgun</strong> — for transactional emails (sign-in links)</li>
          <li><strong>Google Analytics</strong> — for anonymized usage analytics (when enabled)</li>
          <li><strong>Fly.io</strong> — application hosting (Canada / Toronto region)</li>
          <li><strong>Crunchy Bridge</strong> — managed PostgreSQL database (Canada / Montreal region)</li>
          <li><strong>Law enforcement</strong> — if required by Canadian law</li>
        </ul>

        <h2 className="text-lg font-semibold">5. Cookies</h2>
        <p>
          We use a single session cookie (<code className="text-xs">authjs.session-token</code>) for authentication.
          If Google Analytics is enabled, it may set additional cookies for analytics purposes (see Section 1,
          Analytics above). We do not use advertising cookies or third-party tracking pixels.
        </p>

        <h2 className="text-lg font-semibold">6. Your Rights</h2>
        <p>Under Canadian privacy law (PIPEDA) and Alberta&apos;s PIPA, you have the right to:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Access your personal information</li>
          <li>Request correction of inaccurate data</li>
          <li>Request deletion of your account and data</li>
          <li>Withdraw consent for data processing</li>
        </ul>
        <p>
          To exercise any of these rights, email us at{" "}
          <a href="mailto:privacy@tamrack.ca" className="text-accent hover:underline">privacy@tamrack.ca</a>.
          We will respond within 30 days.
        </p>

        <h2 className="text-lg font-semibold">7. Data Retention</h2>
        <p>
          Account data is retained while your account is active. If you cancel your subscription, your account
          data is retained for 90 days in case you wish to re-subscribe, then permanently deleted. API usage
          logs are retained for 30 days.
        </p>

        <h2 className="text-lg font-semibold">8. Changes to This Policy</h2>
        <p>
          We may update this policy from time to time. We will notify active subscribers of material changes
          via email.
        </p>

        <h2 className="text-lg font-semibold">Contact</h2>
        <p>
          Privacy questions? Email{" "}
          <a href="mailto:privacy@tamrack.ca" className="text-accent hover:underline">privacy@tamrack.ca</a>.
        </p>
      </article>
    </main>
  );
}
