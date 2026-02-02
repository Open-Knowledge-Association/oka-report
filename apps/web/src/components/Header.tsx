import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Menu, X } from "lucide-react";

const navItems = [
  { to: "/", label: "Dashboard" },
  { to: "/editors", label: "Editors" },
  { to: "/admin/editors", label: "Admin" },
];

export default function Header() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link to="/" className="text-lg font-semibold tracking-tight text-slate-900">
          OKA Stats Platform
        </Link>

        <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 md:flex">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="transition-colors hover:text-slate-900"
              activeProps={{ className: "text-slate-900" }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <button
          type="button"
          className="rounded-md border border-slate-200 p-2 text-slate-600 md:hidden"
          onClick={() => setIsOpen(true)}
          aria-label="Open menu"
        >
          <Menu size={18} />
        </button>
      </div>

      {isOpen ? (
        <div className="border-t border-slate-200 bg-white md:hidden">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-500">Navigation</span>
              <button
                type="button"
                className="rounded-md border border-slate-200 p-1 text-slate-600"
                onClick={() => setIsOpen(false)}
                aria-label="Close menu"
              >
                <X size={16} />
              </button>
            </div>
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setIsOpen(false)}
                className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                activeProps={{ className: "bg-slate-100 text-slate-900" }}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </header>
  );
}
