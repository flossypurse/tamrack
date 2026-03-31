import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { evaluateAlerts } from "@/lib/edo/alerts";
import {
  DEFAULT_ALERT_RULES,
  type AlertRule,
} from "@/lib/edo/alerts-shared";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.municipalityId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const municipalitySlug = params.get("m") ?? session.user.municipalityId;

  // Parse disabled rule IDs from query string
  const disabledIds = params.getAll("disabled");

  // Parse custom rules from body (not typical for GET but we accept via query JSON)
  let customRules: AlertRule[] = [];
  const customJson = params.get("custom");
  if (customJson) {
    try {
      customRules = JSON.parse(customJson);
    } catch {
      // ignore malformed custom rules
    }
  }

  // Build active rule set
  const allRules = [...DEFAULT_ALERT_RULES, ...customRules];
  const activeRules = allRules.filter((r) => !disabledIds.includes(r.id));

  try {
    const result = await evaluateAlerts(municipalitySlug, activeRules);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[edo/alerts] Error:", error);
    return NextResponse.json(
      { error: "Alert evaluation failed" },
      { status: 500 },
    );
  }
}
