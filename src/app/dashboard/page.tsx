import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import DashboardClient from "./DashboardClient";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  return <DashboardClient email={session.email} />;
}
