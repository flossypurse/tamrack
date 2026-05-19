import { ImageResponse } from "next/og";

export const runtime = "edge";

/**
 * OG image — T3 Terminal chrome.
 *
 *   - dark page (#0B0C0E), warm-ink type (#E8E8E5)
 *   - amber wordmark, mono tagline, mono section labels
 *   - no decorative gradients or radial glows (anti-Vercel-default discipline)
 *   - source/place label in the corner anchors the "the docs are the brand"
 *     register and the rooted-ness anti-drift rule
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get("title");
  const subtitle = searchParams.get("subtitle") || "";

  if (!title) {
    return new Response("Missing required query param: title", { status: 400 });
  }

  // Locked T3 tokens. Amber stays at #E0A03A.
  const PAGE = "#0B0C0E";
  const INK = "#E8E8E5";
  const MID = "#6E6E68";
  const AMBER = "#E0A03A";
  const HAIRLINE = "#1A1B1E";

  // Dynamic title sizing — the mono cut is denser at large sizes
  const titleSize = title.length > 50 ? 48 : title.length > 30 ? 60 : 72;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: PAGE,
          padding: "64px 72px",
          fontFamily: "monospace",
          position: "relative",
        }}
      >
        {/* Top label-strip — instrument register */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingBottom: "20px",
            borderBottom: `1px solid ${HAIRLINE}`,
            fontSize: 14,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: MID,
          }}
        >
          <span>tamrack · alberta data substrate</span>
          <span>tamrack.ca</span>
        </div>

        {/* Main block */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            justifyContent: "center",
            paddingTop: "40px",
            paddingBottom: "40px",
          }}
        >
          {/* Amber prompt + title */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "20px",
            }}
          >
            <span
              style={{
                fontSize: titleSize,
                fontWeight: 800,
                color: AMBER,
                lineHeight: 0.95,
                letterSpacing: "-0.04em",
              }}
            >
              &gt;
            </span>
            <span
              style={{
                fontSize: titleSize,
                fontWeight: 800,
                color: INK,
                lineHeight: 0.95,
                letterSpacing: "-0.04em",
                maxWidth: "950px",
              }}
            >
              {title}
            </span>
          </div>

          {subtitle && (
            <div
              style={{
                fontSize: 26,
                color: MID,
                lineHeight: 1.4,
                maxWidth: "900px",
                marginTop: "32px",
                letterSpacing: "0",
              }}
            >
              {subtitle}
            </div>
          )}
        </div>

        {/* Footer — source/fetched label, mono caps */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingTop: "20px",
            borderTop: `1px solid ${HAIRLINE}`,
            fontSize: 14,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: MID,
          }}
        >
          <span style={{ color: INK }}>the stories the data tells.</span>
          <span>stony plain · alberta</span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
      },
    },
  );
}
