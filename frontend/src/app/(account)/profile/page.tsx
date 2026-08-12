import type { Metadata } from "next";
import { adminMessages } from "@/lib/messages/admin";
import { ProfileView } from "./ProfileView";

export const metadata: Metadata = {
  title: adminMessages.profile.title,
};

export default function ProfilePage() {
  return <ProfileView />;
}
