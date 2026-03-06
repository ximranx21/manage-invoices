"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  LayoutDashboard,
  FileText,
  Users,
  LogOut,
  Package,
  Wallet,
  ClipboardList,
  Menu,
  Plus,
  ChevronRight,
} from "lucide-react";
import type { User } from "@supabase/supabase-js";

const navSections = [
  {
    label: null,
    items: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Management",
    items: [
      { href: "/clients", label: "Clients", icon: Users },
      { href: "/articles", label: "Articles", icon: Package },
    ],
  },
  {
    label: "Commercial",
    items: [
      { href: "/devis", label: "Devis", icon: ClipboardList },
      { href: "/invoices", label: "Invoices", icon: FileText },
    ],
  },
  {
    label: "Finance",
    items: [{ href: "/payments", label: "Payments", icon: Wallet }],
  },
];

function SidebarContent({
  pathname,
  user,
  onSignOut,
  onNavigate,
}: {
  pathname: string;
  user: User;
  onSignOut: () => void;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex h-full flex-col bg-slate-900 text-slate-100">
      {/* Logo */}
      <div className="flex items-center gap-3 border-b border-slate-700/60 px-5 py-5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary">
          <FileText className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <p className="text-sm font-bold leading-none">Invoice Manager</p>
          <p className="mt-0.5 text-[11px] text-slate-400">Gestion commerciale</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {navSections.map((section, si) => (
          <div key={si} className={si > 0 ? "mt-4" : ""}>
            {section.label && (
              <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                {section.label}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isActive = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-slate-300 hover:bg-slate-800 hover:text-white"
                    }`}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span className="flex-1">{item.label}</span>
                    {isActive && <ChevronRight className="h-3.5 w-3.5 opacity-60" />}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-slate-700/60 p-3">
        <div className="mb-2 flex items-center gap-3 rounded-lg px-3 py-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-700 text-xs font-bold uppercase text-slate-200">
            {(user.email?.[0] ?? "U").toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-slate-200">{user.email}</p>
          </div>
        </div>
        <button
          onClick={onSignOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </div>
  );
}

export function AppShell({ user, children }: { user: User; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen bg-muted/40">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-56 md:block">
        <SidebarContent pathname={pathname} user={user} onSignOut={handleSignOut} />
      </aside>

      {/* Mobile: top bar + drawer */}
      <div className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b bg-slate-900 px-4 md:hidden">
        <div className="flex items-center gap-3">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="text-slate-200 hover:bg-slate-800">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-56 p-0">
              <SidebarContent
                pathname={pathname}
                user={user}
                onSignOut={handleSignOut}
                onNavigate={() => setMobileOpen(false)}
              />
            </SheetContent>
          </Sheet>
          <span className="font-bold text-white">Invoice Manager</span>
        </div>
        <Link href="/invoices/new">
          <Button size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" /> New Invoice
          </Button>
        </Link>
      </div>

      {/* Main content */}
      <main className="flex-1 md:ml-56">
        {/* Desktop top bar */}
        <div className="hidden h-14 items-center justify-between border-b bg-background px-6 md:flex">
          <p className="text-sm text-muted-foreground">
            {/* Current section title */}
            {navSections
              .flatMap((s) => s.items)
              .find((item) => pathname.startsWith(item.href))?.label ?? ""}
          </p>
          <Link href="/invoices/new">
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" /> New Invoice
            </Button>
          </Link>
        </div>

        <div className="px-4 py-6 pt-20 md:px-6 md:pt-6">
          {children}
        </div>
      </main>
    </div>
  );
}
