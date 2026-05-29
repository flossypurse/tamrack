// /home and its children (dashboard, learn, signals, briefings) compose
// upstream-backed widgets. force-dynamic on the segment stops the CI build
// gate from failing when an upstream is briefly unreachable from the GH
// Actions runner.
export const dynamic = "force-dynamic";

export default function HomeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
