import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import ScanClient from "./ScanClient";

export default async function ScanPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  return <ScanClient email={session.email} />;
}
