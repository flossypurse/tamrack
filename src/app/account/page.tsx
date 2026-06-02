import { redirect } from "next/navigation";

// The account launchpad collapsed into the workspace. The chat is the home;
// key/token management lives in the workspace left rail.
export default function AccountPage() {
  redirect("/account/chat");
}
