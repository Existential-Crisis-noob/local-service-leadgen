import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentWorkspaceId } from "@/lib/workspace";
import { getActiveMailboxForWorkspace } from "@/lib/mailbox/getWorkspaceMailbox";
import { SidebarNav, type SidebarLink } from "@/components/sidebar-nav";
import { signOutAction } from "./actions";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const workspaceId = await getCurrentWorkspaceId(session.user.id);
  const [workspace, campaignCount, prospectCount, qualifiedCount, draftCount, sentCount, replyCount, mailbox] =
    await Promise.all([
      prisma.workspace.findUnique({ where: { id: workspaceId } }),
      prisma.campaign.count({ where: { workspaceId } }),
      prisma.business.count({ where: { workspaceId } }),
      prisma.business.count({ where: { workspaceId, score: { qualified: true } } }),
      prisma.draftEmail.count({
        where: { business: { workspaceId }, status: { in: ["PENDING", "EDITED"] } },
      }),
      prisma.sentMessage.count({ where: { draft: { business: { workspaceId } } } }),
      prisma.reply.count({
        where: { status: "NEEDS_REVIEW", sentMessage: { draft: { business: { workspaceId } } } },
      }),
      getActiveMailboxForWorkspace(workspaceId),
    ]);

  const links: SidebarLink[] = [
    { href: "/campaigns", label: "Campaigns", shortLabel: "Campaigns", count: campaignCount, icon: "◎" },
    { href: "/prospects", label: "All prospects", shortLabel: "All prospects", count: prospectCount, icon: "▦" },
    {
      href: "/prospects/qualified",
      label: "Qualified prospects",
      shortLabel: "Qualified",
      count: qualifiedCount,
      icon: "✓",
    },
    { href: "/drafts", label: "Drafts awaiting approval", shortLabel: "Awaiting approval", count: draftCount, icon: "▤" },
    { href: "/sent", label: "Sent and follow-ups", shortLabel: "Sent & follow-ups", count: sentCount, icon: "↗" },
    { href: "/replies", label: "Replies requiring review", shortLabel: "Replies", count: replyCount, icon: "✉" },
    { href: "/suppressed", label: "Unsubscribed and suppressed", shortLabel: "Suppressed", icon: "⊘" },
    { href: "/performance", label: "Source and campaign performance", shortLabel: "Performance", icon: "▥" },
  ];

  const displayName = session.user.name ?? session.user.email?.split("@")[0] ?? "Account";
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">L</span>
          <span>
            <strong>LocalSignal</strong>
            <small>Business discovery</small>
          </span>
        </div>
        <div className="workspace-switch">
          <span className="avatar-letter">{(workspace?.name ?? "W").charAt(0).toUpperCase()}</span>
          <span>
            <strong>{workspace?.name ?? "Workspace"}</strong>
            <small>Approved sources only</small>
          </span>
        </div>
        <SidebarNav links={links} />
        <div className="sidebar-lower">
          <div className="mailbox-card">
            <div className="mailbox-head">
              <span className="gmail-icon">M</span>
              <span>
                <strong>Gmail</strong>
                <small>{mailbox?.emailAddress ?? "Not connected"}</small>
              </span>
              <b className={mailbox ? "connected" : "disconnected"}>{mailbox ? "Connected" : "Offline"}</b>
            </div>
            <a href="/sent">{mailbox ? "Manage mailbox" : "Connect mailbox"}</a>
          </div>
          <div className="user-card">
            <span className="user-avatar">{initial}</span>
            <span className="user-identity">
              <strong>{displayName}</strong>
              <small>{session.user.email}</small>
            </span>
            <form action={signOutAction}>
              <button type="submit" className="sign-out" aria-label="Sign out" title="Sign out">
                ↪
              </button>
            </form>
          </div>
        </div>
      </aside>
      <main className="main-area">
        <header className="topbar">
          <div>
            <strong>Lead workspace</strong>
            <span>Discover → qualify → review → send</span>
          </div>
          <div className="safety-indicator">
            <i /> Human approval required
          </div>
        </header>
        <div className="content">{children}</div>
      </main>
    </div>
  );
}
