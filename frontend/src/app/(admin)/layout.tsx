import { AdminNav } from "./AdminNav";

/**
 * Sidebar shell for the admin area.
 *
 * Access is enforced twice over: middleware.ts keeps other roles off these
 * URLs, and every API call behind them is checked again by NestJS. This layout
 * is presentation only.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <AdminNav />
      <main className="flex-1 bg-background px-4 py-8 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
