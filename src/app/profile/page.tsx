import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import ProfileClient from "./ProfileClient";

export default async function ProfilePage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  return <ProfileClient email={session.email} />;
}
