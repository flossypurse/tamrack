import { redirect } from "next/navigation";

export default function ElectionsRedirect() {
  redirect("/politics/legislature");
}
