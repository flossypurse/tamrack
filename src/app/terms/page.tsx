import Link from "next/link";
import { Activity } from "lucide-react";

export default function TermsPage() {
  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-2 mb-8">
        <Link href="/" className="flex items-center gap-2 text-muted hover:text-foreground transition-colors">
          <Activity size={18} className="text-accent" />
          <span className="text-sm font-semibold">Alberta Pulse Check</span>
        </Link>
      </div>

      <article className="prose prose-invert prose-sm max-w-none space-y-6 text-muted [&_h1]:text-foreground [&_h2]:text-foreground [&_h3]:text-foreground [&_strong]:text-foreground">
        <h1 className="text-2xl font-bold text-foreground">Terms of Service</h1>
        <p className="text-xs text-muted/60">Last updated: March 2026</p>

        <h2 className="text-lg font-semibold">1. Agreement to Terms</h2>
        <p>
          By accessing or using Alberta Pulse Check (&ldquo;the Service&rdquo;), you agree to be bound by these Terms of Service.
          If you do not agree, do not use the Service.
        </p>

        <h2 className="text-lg font-semibold">2. Description of Service</h2>
        <p>
          Alberta Pulse Check provides economic data dashboards and APIs aggregating publicly available data from
          government sources including Bank of Canada, Statistics Canada, and municipal open data portals. The Service
          processes and presents this data for informational purposes.
        </p>

        <h2 className="text-lg font-semibold">3. Subscriptions and Billing</h2>
        <p>
          The Service offers a paid subscription at $29 CAD per month. New accounts receive a 14-day free trial.
          Subscriptions are billed monthly through Stripe. You may cancel at any time through the billing portal;
          access continues until the end of the current billing period.
        </p>

        <h2 className="text-lg font-semibold">4. API Usage</h2>
        <p>
          Subscribers may access the REST API using API keys. Usage is limited to 1,000 requests per day per key.
          API keys must not be shared publicly. We reserve the right to revoke keys that are abused or used in
          violation of these terms.
        </p>

        <h2 className="text-lg font-semibold">5. Data Accuracy</h2>
        <p>
          <strong>The Service is for informational purposes only.</strong> While we strive for accuracy, data is
          sourced from third-party government APIs and may contain errors, delays, or gaps. We do not guarantee the
          accuracy, completeness, or timeliness of any data. Do not rely solely on this Service for financial,
          investment, or business decisions.
        </p>

        <h2 className="text-lg font-semibold">6. Limitation of Liability</h2>
        <p>
          To the maximum extent permitted by law, Alberta Pulse Check and its operators shall not be liable for any
          indirect, incidental, special, consequential, or punitive damages resulting from your use of the Service,
          including but not limited to financial losses based on data presented by the Service.
        </p>

        <h2 className="text-lg font-semibold">7. Account Responsibility</h2>
        <p>
          You are responsible for maintaining the security of your account credentials and API keys. You are
          responsible for all activity under your account.
        </p>

        <h2 className="text-lg font-semibold">8. Termination</h2>
        <p>
          We may suspend or terminate your account if you violate these terms, abuse the API, or engage in any
          activity that harms the Service or other users. You may delete your account at any time by contacting us.
        </p>

        <h2 className="text-lg font-semibold">9. Changes to Terms</h2>
        <p>
          We may update these terms from time to time. Continued use of the Service after changes constitutes
          acceptance of the new terms.
        </p>

        <h2 className="text-lg font-semibold">10. Governing Law</h2>
        <p>
          These terms are governed by the laws of the Province of Alberta, Canada.
        </p>

        <h2 className="text-lg font-semibold">Contact</h2>
        <p>
          Questions about these terms? Contact us at the email address associated with your account.
        </p>
      </article>
    </main>
  );
}
