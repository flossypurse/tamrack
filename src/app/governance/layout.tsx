// All /governance/* routes call Elections Canada, OpenParliament,
// open.canada.ca, and other upstream APIs during render. force-dynamic on
// the segment stops the CI build gate from failing when an upstream is
// briefly unreachable from the GH Actions runner.
export const dynamic = "force-dynamic";

export default function GovernanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
