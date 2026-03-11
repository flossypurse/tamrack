import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createApiKey, getUserApiKeys, revokeApiKey } from "@/lib/api-keys";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const keys = getUserApiKeys(session.user.id);
  return NextResponse.json({ keys });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name } = await req.json().catch(() => ({ name: "Default" }));
  const result = createApiKey(session.user.id, name || "Default");
  return NextResponse.json(result);
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { keyId } = await req.json();
  const success = revokeApiKey(keyId, session.user.id);
  if (!success) {
    return NextResponse.json({ error: "Key not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
