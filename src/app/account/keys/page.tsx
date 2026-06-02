import { redirect } from "next/navigation";

// API key management folded into the workspace left rail. The one-shot key
// reveal (after invite redemption) is read there from the /account-scoped
// cookie; this route just sends people to the workspace.
export default function ApiKeysPage() {
  redirect("/account/chat");
}
