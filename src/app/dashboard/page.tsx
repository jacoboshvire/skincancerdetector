import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import OverviewClient from "./OverviewClient";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  return <OverviewClient email={session.email} />;
}
