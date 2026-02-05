import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Menu, X } from "lucide-react";

const navItems = [
  { to: "/", label: "Dashboard" },
  { to: "/editors", label: "Editors" },
  { to: "/articles", label: "Articles" },
  { to: "/admin/editors", label: "Admin" },
  { to: "/admin/sync-jobs", label: "Sync Jobs" },
];

export default function Header() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <aside className="hidden w-64 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="flex h-16 items-center px-6">
          <Link to="/" className="text-sm font-semibold tracking-tight text-slate-900">
            OKA Stats Platform
          </Link>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3 py-4 text-sm font-medium text-slate-600">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="rounded-md px-3 py-2 transition-colors hover:bg-slate-100 hover:text-slate-900"
              activeProps={{ className: "bg-slate-100 text-slate-900" }}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-slate-200 px-6 py-4 text-xs text-slate-500">
          OKA Stats Platform
        </div>
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
          <span className="text-sm font-semibold text-slate-900">OKA Stats</span>
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
            <nav className="flex flex-col gap-1 px-3 py-4 text-sm font-medium text-slate-600">
              {navItems.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setIsOpen(false)}
                  className="rounded-md px-3 py-2 transition-colors hover:bg-slate-100 hover:text-slate-900"
                  activeProps={{ className: "bg-slate-100 text-slate-900" }}
                >
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
