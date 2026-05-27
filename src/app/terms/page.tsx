import type { Metadata } from "next";
import Link from "next/link";
import { Activity } from "lucide-react";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms of Service for Tamrack — economic intelligence dashboard for Alberta.",
};

export default function TermsPage() {
  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-2 mb-8">
        <Link href="/" className="flex items-center gap-2 text-muted hover:text-foreground transition-colors">
          <Activity size={18} className="text-accent" />
          <span className="text-sm font-semibold">Tamrack</span>
        </Link>
      </div>

      <article className="prose prose-invert prose-sm max-w-none space-y-6 text-muted [&_h1]:text-foreground [&_h2]:text-foreground [&_h3]:text-foreground [&_strong]:text-foreground">
        <h1 className="text-2xl font-bold text-foreground">Terms of Service</h1>
        <p className="text-xs text-muted/60">Last updated: March 2026</p>

        <h2 className="text-lg font-semibold">1. Agreement to Terms</h2>
        <p>
          By accessing or using Tamrack (&ldquo;the Service&rdquo;), you agree to be bound by these Terms of Service.
          If you do not agree, do not use the Service.
        </p>

        <h2 className="text-lg font-semibold">2. Description of Service</h2>
        <p>
          Tamrack provides economic data dashboards, embeddable charts, and APIs aggregating
          publicly available data from government sources including but not limited to: Bank of Canada,
          Statistics Canada, Alberta Open Data, the Canada Energy Regulator (CER),
          Immigration Refugees and Citizenship Canada (IRCC), Infrastructure Canada,
          Alberta Energy Regulator (AER), and municipal open data portals across Alberta.
        </p>
        <p>
          The Service processes and presents this data for informational purposes only.
        </p>

        <h2 className="text-lg font-semibold">3. Service Tiers</h2>

        <h3 className="text-base font-medium">Free Tier</h3>
        <p>
          The free tier provides access to province-wide macro economic dashboards, the municipality explorer,
          and the coverage map. No account is required for free-tier content.
        </p>

        <h3 className="text-base font-medium">Pro Subscription ($29 CAD/month)</h3>
        <p>
          The Pro tier includes municipality deep-dive dashboards, REST API access, embeddable charts, and
          briefings. New accounts receive a 14-day free trial with no credit card required. After the trial,
          subscriptions are billed monthly through Stripe. You may cancel at any time through the billing
          portal; access continues until the end of the current billing period.
        </p>

        <h2 className="text-lg font-semibold">4. API Usage</h2>
        <p>
          Subscribers may access the REST API using API keys. Usage is limited to 1,000 requests per day per key.
          API keys must not be shared publicly. We reserve the right to revoke keys that are abused or used in
          violation of these terms.
        </p>

        <h2 className="text-lg font-semibold">5. Embeddable Charts</h2>
        <p>
          Pro subscribers may embed charts on external websites using the provided embed URLs. Embedded charts
          must retain the Tamrack attribution link. You may not modify, remove, or obscure the
          attribution. We reserve the right to disable embed access for accounts that violate this requirement.
        </p>

        <h2 className="text-lg font-semibold">6. Data Accuracy</h2>
        <p>
          <strong>The Service is for informational purposes only.</strong> While we strive for accuracy, data is
          sourced from third-party government APIs and may contain errors, delays, or gaps. We do not guarantee the
          accuracy, completeness, or timeliness of any data. Do not rely solely on this Service for financial,
          investment, or business decisions.
        </p>

        <h2 className="text-lg font-semibold">7. Intellectual Property</h2>
        <p>
          The Service&apos;s interface, design, and proprietary analysis are owned by Tamrack. The
          underlying data is sourced from public government sources and remains subject to the respective
          government open data licences. You may use data obtained through the API or embeds for your own
          purposes, provided you comply with applicable government open data licence terms.
        </p>

        <h2 className="text-lg font-semibold">8. Limitation of Liability</h2>
        <p>
          To the maximum extent permitted by law, Tamrack and its operators shall not be liable for any
          indirect, incidental, special, consequential, or punitive damages resulting from your use of the Service,
          including but not limited to financial losses based on data presented by the Service.
        </p>

        <h2 className="text-lg font-semibold">9. Account Responsibility</h2>
        <p>
          You are responsible for maintaining the security of your account credentials and API keys. You are
          responsible for all activity under your account.
        </p>

        <h2 className="text-lg font-semibold">10. Termination</h2>
        <p>
          We may suspend or terminate your account if you violate these terms, abuse the API, or engage in any
          activity that harms the Service or other users. You may delete your account at any time by contacting us
          at <a href="mailto:support@tamrack.ca" className="text-accent hover:underline">support@tamrack.ca</a>.
        </p>

        <h2 className="text-lg font-semibold">11. Changes to Terms</h2>
        <p>
          We may update these terms from time to time. We will notify active subscribers of material changes via
          email. Continued use of the Service after changes constitutes acceptance of the new terms.
        </p>

        <h2 className="text-lg font-semibold">12. Governing Law</h2>
        <p>
          These terms are governed by the laws of the Province of Alberta, Canada.
        </p>

        <h2 className="text-lg font-semibold">Contact</h2>
        <p>
          Questions about these terms? Email{" "}
          <a href="mailto:support@tamrack.ca" className="text-accent hover:underline">support@tamrack.ca</a>.
        </p>
      </article>
    </main>
  );
}
