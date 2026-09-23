"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface SidebarLink {
  href: string;
  label: string;
  shortLabel: string;
  count?: number;
  icon: string;
}

export function SidebarNav({ links }: { links: SidebarLink[] }) {
  const pathname = usePathname();

  return (
    <nav className="side-nav" aria-label="Workspace navigation">
      {links.map((link) => {
        const active =
          pathname === link.href ||
          (link.href === "/campaigns" && pathname.startsWith("/campaigns/")) ||
          (link.href !== "/campaigns" &&
            link.href !== "/prospects" &&
            pathname.startsWith(`${link.href}/`));
        return (
          <Link key={link.href} href={link.href} className={active ? "active" : undefined}>
            <span className="nav-icon" aria-hidden="true">
              {link.icon}
            </span>
            <span>{link.shortLabel}</span>
            {link.count !== undefined && link.count > 0 && <em>{link.count}</em>}
          </Link>
        );
      })}
    </nav>
  );
}
