import type { Metadata } from "next";
import { adminMessages } from "@/lib/messages/admin";
import { UsersTable } from "./UsersTable";

export const metadata: Metadata = {
  title: adminMessages.users.title,
};

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  // The dashboard links here with ?status=SUSPENDED, so the filter starts
  // where the tile that was clicked pointed.
  const { status } = await searchParams;

  return <UsersTable initialStatus={status === "SUSPENDED" ? "SUSPENDED" : undefined} />;
}
