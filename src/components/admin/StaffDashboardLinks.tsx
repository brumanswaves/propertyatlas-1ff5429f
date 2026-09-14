import { Link } from "@tanstack/react-router";
import { LayoutDashboard } from "lucide-react";
import { useStaffAccess } from "@/lib/auth/StaffAccess";
import { staffNavigation } from "@/lib/navigation";

export function StaffDashboardLinks() {
  const { role } = useStaffAccess();
  const links = staffNavigation(role);
  return links.length ? <nav aria-label="Your work dashboards" className="my-4 flex flex-wrap gap-2">
    {links.map((link) => <Link key={link.to} to={link.to} className="inline-flex items-center gap-2 rounded border border-border bg-card px-3 py-2 text-sm font-semibold">
      <LayoutDashboard className="h-4 w-4" />{link.label}
    </Link>)}
  </nav> : null;
}
