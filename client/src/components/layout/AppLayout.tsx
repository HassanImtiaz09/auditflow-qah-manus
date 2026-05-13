// AuditFlow QAH — AppLayout
// Design: Fixed 240px dark navy sidebar, cool off-white content area
// Sidebar: deep navy (#0f2744 approx), active items have left border accent

import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  ClipboardList,
  Search,
  CheckSquare,
  BookOpen,
  BarChart3,
  Download,
  Settings,
  CalendarDays,
  ShieldCheck,
  Users,
  ClipboardCheck,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { AppUser } from "@/lib/store";
import { getSubmissions, getAllUsers, setCurrentUser, getUnreadNotificationCount } from "@/lib/store";
import { ChevronDown } from "lucide-react";

interface NavItem {
  path: string;
  label: string;
  icon: React.ElementType;
  consultantOnly?: boolean;
  adminOnly?: boolean;
  badge?: boolean;
  badgeKey?: "pending" | "notif";
}

interface NavSection {
  label?: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    label: "Submissions",
    items: [
      { path: "/",              label: "Submit Audit",   icon: ClipboardList },
      { path: "/check-status",  label: "Check Status",   icon: Search },
    ],
  },
  {
    label: "Review",
    items: [
      { path: "/approval-queue",label: "Approval Queue", icon: CheckSquare, badge: true },
      { path: "/registry",      label: "Audit Registry", icon: BookOpen },
      { path: "/calendar",      label: "Audit Calendar", icon: CalendarDays },
    ],
  },
  {
    label: "Reporting",
    items: [
      { path: "/statistics",    label: "Statistics",     icon: BarChart3 },
      { path: "/export",        label: "Export Data",    icon: Download },
    ],
  },
  {
    label: "Administration",
    items: [
      { path: "/settings",      label: "Settings",       icon: Settings,      consultantOnly: true },
      { path: "/decision-log",  label: "Decision Log",   icon: ShieldCheck,   consultantOnly: true },
      { path: "/users",         label: "User Management",icon: Users,         adminOnly: true },
      { path: "/approvals",     label: "User Approvals", icon: ClipboardCheck,adminOnly: true, badge: true, badgeKey: "notif" },
    ],
  },
];

interface Props {
  user: AppUser;
  children: React.ReactNode;
  onUserSwitch?: (user: AppUser) => void;
  onLogout?: () => void;
}

export default function AppLayout({ user, children, onUserSwitch, onLogout }: Props) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);

  const allUsers = getAllUsers().filter((u) => u.approved);

  const handleSwitchUser = (u: AppUser) => {
    setCurrentUser(u);
    setSwitcherOpen(false);
    onUserSwitch?.(u);
  };

  const isConsultant = user.role === "consultant" || user.role === "admin";
  const isAdmin = user.role === "admin";

  const pendingCount = getSubmissions().filter((s) => s.status === "pending").length;
  const notifCount = getUnreadNotificationCount();

  const filteredSections = NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter(
      (item) =>
        (!item.consultantOnly || isConsultant) &&
        (!item.adminOnly || isAdmin)
    ),
  })).filter((s) => s.items.length > 0);

  const navContent = (
    <div className="flex flex-col" style={{ fontFamily: "Inter, sans-serif", height: "100%", overflow: "hidden" }}>
      {/* Header */}
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-9 h-9 rounded-lg bg-blue-500 flex items-center justify-center flex-shrink-0">
            <ClipboardList className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-white leading-tight">AuditFlow ENT</h1>
            <p className="text-[10px] text-white/50">QAH Audit Registry</p>
          </div>
        </div>
        {/* Trust badge */}
        <div className="bg-white/10 rounded-lg px-3 py-2">
          <p className="text-[10px] text-white/70 leading-tight">Portsmouth Hospitals</p>
          <p className="text-[10px] text-white/50 leading-tight">University NHS Trust</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 overflow-y-auto space-y-4">
        {filteredSections.map((section) => (
          <div key={section.label}>
            {section.label && (
              <p className="px-3 mb-1 text-[9px] font-semibold uppercase tracking-widest text-white/30">
                {section.label}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = location === item.path;
                const badgeVal = item.badgeKey === "notif" ? notifCount : pendingCount;
                const showBadge = item.badge && badgeVal > 0;
                return (
                  <Link
                    key={item.path}
                    href={item.path}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-150 ${
                      isActive
                        ? "bg-white/15 text-white border-l-[3px] border-blue-400 pl-[9px]"
                        : "text-white/60 hover:text-white hover:bg-white/8"
                    }`}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    <span className="flex-1">{item.label}</span>
                    {showBadge && (
                      <Badge className="bg-red-500 text-white text-[10px] px-1.5 py-0 min-w-[20px] flex items-center justify-center h-5 hover:bg-red-500">
                        {badgeVal}
                      </Badge>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User footer with switcher */}
      <div className="p-4 border-t border-white/10 relative">
        {/* Demo user switcher dropdown */}
        {switcherOpen && (
          <div className="absolute bottom-full left-3 right-3 mb-2 bg-white rounded-xl shadow-xl border border-border overflow-hidden z-50">
            <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground px-3 py-2 border-b border-border">
              Switch demo user
            </p>
            {allUsers.map((u) => (
              <button
                key={u.id}
                onClick={() => handleSwitchUser(u)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-muted/50 transition-colors ${
                  u.id === user.id ? "bg-muted/30" : ""
                }`}
              >
                <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-[10px] font-semibold flex-shrink-0">
                  {u.full_name[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium text-foreground truncate">{u.full_name}</p>
                  <p className="text-[9px] text-muted-foreground capitalize">{u.role}</p>
                </div>
                {u.id === user.id && (
                  <span className="text-[9px] text-primary font-semibold">Active</span>
                )}
              </button>
            ))}
          </div>
        )}
        <button
          onClick={() => setSwitcherOpen(!switcherOpen)}
          className="w-full flex items-center gap-3 hover:bg-white/8 rounded-lg p-1 -m-1 transition-colors"
        >
          <div className="w-8 h-8 rounded-full bg-blue-500/30 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
            {user.full_name?.[0]?.toUpperCase() || "U"}
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-xs font-medium text-white truncate">{user.full_name}</p>
            <p className="text-[10px] text-white/50 capitalize">{user.grade || user.role}</p>
          </div>
          <ChevronDown className={`w-3.5 h-3.5 text-white/40 transition-transform flex-shrink-0 ${switcherOpen ? "rotate-180" : ""}`} />
        </button>
        {onLogout && (
          <button
            onClick={onLogout}
            className="mt-2 w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/8 transition-colors text-[11px]"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign out</span>
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg text-white shadow-lg"
        style={{ background: "oklch(0.19 0.04 255)" }}
      >
        {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 w-[240px] z-40 transition-transform duration-200 lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ background: "oklch(0.19 0.04 255)", height: "100vh", display: "flex", flexDirection: "column" }}
      >
        {navContent}
      </aside>

      {/* Main content */}
      <main className="flex-1 ml-0 lg:ml-[240px] overflow-y-auto">
        <div className="min-h-full pb-8">
          {children}
        </div>
      </main>
    </div>
  );
}
