import { redirect } from "next/navigation";

// MCP token management (mint / list / revoke / install snippet) folded into
// the workspace left rail. This route just sends people to the workspace.
export default function AccountMcpPage() {
  redirect("/account/chat");
}
