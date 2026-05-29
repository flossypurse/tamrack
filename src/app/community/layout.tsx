// All /community/* routes call StatsCan, Edmonton Socrata, CWFIS, and other
// upstream APIs during render. Prerendering them at build time made CI
// hostage to upstream uptime (60s-per-page budget × 3 retries → builds fail
// at random). force-dynamic here applies to every child route in this segment.
export const dynamic = "force-dynamic";

export default function CommunityLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
