// All /economy/* routes call StatsCan, CER, BoC, and other upstream APIs
// during render. force-dynamic on the segment stops the CI build gate from
// failing when an upstream is briefly unreachable from the GH Actions runner.
export const dynamic = "force-dynamic";

export default function EconomyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
