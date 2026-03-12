import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get("title");
  const subtitle = searchParams.get("subtitle") || "";
  const type = searchParams.get("type") || "data";

  if (!title) {
    return new Response("Missing required query param: title", { status: 400 });
  }

  const RUST = "#d4863a";
  const BG = "#0c0f14";
  const MUTED = "#9ca3af";

  const mapPinSvg = (
    <svg
      width="28"
      height="36"
      viewBox="0 0 24 32"
      fill="none"
      style={{ marginRight: "10px" }}
    >
      <path
        d="M12 0C5.373 0 0 5.373 0 12c0 9 12 20 12 20s12-11 12-20c0-6.627-5.373-12-12-12zm0 16a4 4 0 110-8 4 4 0 010 8z"
        fill={RUST}
      />
    </svg>
  );

  // Dynamic font size based on title length
  const titleSize = title.length > 50 ? 36 : title.length > 30 ? 44 : 52;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: BG,
          padding: "60px",
          fontFamily: "sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Gradient accent line at top */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "5px",
            background: `linear-gradient(to right, ${RUST}, ${RUST}44, transparent)`,
          }}
        />

        {/* Subtle gradient overlay in top-right corner */}
        <div
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            width: "500px",
            height: "500px",
            background: `radial-gradient(circle at top right, ${RUST}12, transparent 70%)`,
          }}
        />

        {/* Main content */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            justifyContent: "center",
          }}
        >
          {/* Title row — with optional map pin for municipality type */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
            }}
          >
            {type === "municipality" && mapPinSvg}
            <div
              style={{
                fontSize: titleSize,
                fontWeight: 700,
                color: "#ffffff",
                lineHeight: 1.2,
                maxWidth: "1000px",
              }}
            >
              {title}
            </div>
          </div>

          {/* Subtitle */}
          {subtitle && (
            <div
              style={{
                fontSize: 24,
                color: MUTED,
                lineHeight: 1.4,
                maxWidth: "900px",
                marginTop: "16px",
              }}
            >
              {subtitle}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
          }}
        >
          {/* Branding bottom-left */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <div
              style={{
                width: "12px",
                height: "12px",
                backgroundColor: RUST,
                borderRadius: "2px",
                transform: "rotate(45deg)",
              }}
            />
            <div
              style={{
                fontSize: 20,
                fontWeight: 600,
                color: RUST,
              }}
            >
              Alberta Pulse Check
            </div>
          </div>

          {/* URL bottom-right */}
          <div
            style={{
              fontSize: 16,
              color: "#52525b",
            }}
          >
            albertapulsecheck.ca
          </div>
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
