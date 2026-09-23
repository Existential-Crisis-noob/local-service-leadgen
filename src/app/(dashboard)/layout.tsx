import Link from "next/link";
import { NAV_LINKS } from "@/lib/nav";
import { auth } from "@/auth";
import { signOutAction } from "./actions";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">Lead Gen</div>
        <nav>
          <ul>
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href}>{link.label}</Link>
              </li>
            ))}
          </ul>
        </nav>
        {session?.user && (
          <div className="user-card">
            <div className="user-email">{session.user.email}</div>
            <form action={signOutAction}>
              <button type="submit" className="sign-out">
                Sign out
              </button>
            </form>
          </div>
        )}
      </aside>
      <main className="content">{children}</main>
    </div>
  );
}
