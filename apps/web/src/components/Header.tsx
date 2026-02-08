import { Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  Menu,
  X,
  LayoutDashboard,
  Users,
  FileText,
  History,
  Calendar,
  RefreshCw,
  HelpCircle,
  LogOut,
  User,
} from "lucide-react";
import { useAuth } from "../lib/auth";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/editors", label: "Editors", icon: Users },
  { to: "/articles", label: "Articles", icon: FileText },
  { to: "/admin/history", label: "History", icon: History },
  { to: "/admin/schedule-manager", label: "Schedule", icon: Calendar },
  { to: "/admin/sync-jobs", label: "Sync Jobs", icon: RefreshCw },
  { to: "/help", label: "Help", icon: HelpCircle },
];

function AuthSection() {
  const { user, isLoading, isAuthenticated, signOut } = useAuth();

  if (isLoading) {
    return (
      <div className="px-6 py-4 border-t border-slate-200">
        <div className="text-sm text-slate-500">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="px-3 pb-4 border-t border-slate-200">
        <a
          href="/api/auth/google"
          className="group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
        >
          <User className="h-4 w-4 text-slate-500 group-hover:text-slate-900 transition-colors" />
          Sign in with Google
        </a>
      </div>
    );
  }

  return (
    <div className="px-6 py-4 border-t border-slate-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600">
            <User className="h-4 w-4" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium text-slate-900">{user?.name || user?.email}</span>
            <span className="text-xs text-slate-500 capitalize">{user?.role}</span>
          </div>
        </div>
        <button
          onClick={() => signOut()}
          className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
          title="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export default function Header() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <aside className="hidden w-64 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="flex h-16 items-center gap-3 px-6">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white shadow-sm">
            <span className="text-lg font-bold leading-none">O</span>
          </div>
          <span className="text-sm font-semibold tracking-tight text-slate-900">OKA Stats</span>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
          {navItems
            .filter((item) => item.to !== "/help")
            .map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
                activeProps={{ className: "bg-slate-100 text-slate-900 font-semibold" }}
              >
                <item.icon className="h-4 w-4 text-slate-500 group-hover:text-slate-900 transition-colors" />
                {item.label}
              </Link>
            ))}
        </nav>
        <div className="px-3 pb-4">
          <Link
            to="/help"
            className="group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
            activeProps={{ className: "bg-slate-100 text-slate-900 font-semibold" }}
          >
            <HelpCircle className="h-4 w-4 text-slate-500 group-hover:text-slate-900 transition-colors" />
            Help
          </Link>
        </div>
        <AuthSection />
      </aside>

      <header className="fixed inset-x-0 top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur lg:hidden">
        <div className="flex h-14 items-center justify-between px-4">
          <button
            type="button"
            className="rounded-md border border-slate-200 p-2 text-slate-600"
            onClick={() => setIsOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={18} />
          </button>
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-slate-900 text-white shadow-sm">
              <span className="text-xs font-bold leading-none">O</span>
            </div>
            <span className="text-sm font-semibold text-slate-900">OKA Stats</span>
          </div>
          <span className="h-8 w-8" aria-hidden="true" />
        </div>
      </header>

      {isOpen ? (
        <div
          className="fixed inset-0 z-50 bg-slate-950/40 lg:hidden"
          onClick={() => setIsOpen(false)}
          role="presentation"
        >
          <div
            className="h-full w-72 bg-white shadow-xl"
            onClick={(event) => event.stopPropagation()}
            role="presentation"
          >
            <div className="flex h-14 items-center justify-between border-b border-slate-200 px-4">
              <span className="text-sm font-semibold text-slate-900">Navigation</span>
              <button
                type="button"
                className="rounded-md border border-slate-200 p-1 text-slate-600"
                onClick={() => setIsOpen(false)}
                aria-label="Close menu"
              >
                <X size={16} />
              </button>
            </div>
            <nav className="flex flex-col gap-1 px-3 py-4">
              {navItems.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setIsOpen(false)}
                  className="group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
                  activeProps={{ className: "bg-slate-100 text-slate-900 font-semibold" }}
                >
                  <item.icon className="h-4 w-4 text-slate-500 group-hover:text-slate-900" />
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      ) : null}
    </>
  );
}
