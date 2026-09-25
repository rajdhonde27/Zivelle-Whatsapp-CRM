"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  MessageSquare,
  Users,
  GitBranch,
  ShoppingBag,
  Menu,
  Radio,
  Zap,
  Workflow,
  Bot,
  Settings,
  LogOut,
  X,
} from "lucide-react";
import { useTotalUnread } from "@/hooks/use-total-unread";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export function MobileNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const totalUnread = useTotalUnread();
  const { signOut } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);

  // When a chat is open in mobile inbox, hide bottom nav to prioritize composer and keyboard
  const isChatOpen = pathname.startsWith("/inbox") && searchParams.get("c");
  if (isChatOpen) {
    return null;
  }

  const navItems = [
    {
      href: "/inbox",
      label: "Chats",
      icon: MessageSquare,
      badge: totalUnread > 0 ? totalUnread : null,
      active: pathname.startsWith("/inbox"),
    },
    {
      href: "/contacts",
      label: "Contacts",
      icon: Users,
      badge: null,
      active: pathname.startsWith("/contacts"),
    },
    {
      href: "/pipelines",
      label: "Pipelines",
      icon: GitBranch,
      badge: null,
      active: pathname.startsWith("/pipelines"),
    },
    {
      href: "/catalog",
      label: "Catalog",
      icon: ShoppingBag,
      badge: null,
      active: pathname.startsWith("/catalog"),
    },
  ];

  return (
    <>
      <nav
        aria-label="Mobile Navigation"
        className="fixed bottom-0 inset-x-0 z-40 border-t border-border bg-card/95 backdrop-blur-md lg:hidden pb-[env(safe-area-inset-bottom)]"
      >
        <div className="flex h-15 items-center justify-around px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative flex flex-1 flex-col items-center justify-center py-1 transition-colors",
                  item.active
                    ? "text-primary font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <div className="relative">
                  <Icon className="h-5 w-5" />
                  {item.badge !== null && (
                    <span className="absolute -top-1.5 -right-2.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground shadow-xs">
                      {item.badge > 99 ? "99+" : item.badge}
                    </span>
                  )}
                </div>
                <span className="mt-1 text-[10px]">{item.label}</span>
              </Link>
            );
          })}

          {/* More Sheet Trigger */}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={cn(
              "flex flex-1 flex-col items-center justify-center py-1 transition-colors text-muted-foreground hover:text-foreground",
              (pathname.startsWith("/settings") ||
                pathname.startsWith("/broadcasts") ||
                pathname.startsWith("/automations") ||
                pathname.startsWith("/flows") ||
                pathname.startsWith("/agents")) &&
                "text-primary font-semibold"
            )}
          >
            <Menu className="h-5 w-5" />
            <span className="mt-1 text-[10px]">More</span>
          </button>
        </div>
      </nav>

      {/* More Drawer Sheet */}
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="p-0 rounded-t-2xl border-t border-border bg-card pb-[env(safe-area-inset-bottom)]">
          <SheetHeader className="border-b border-border p-4 pb-3 flex flex-row items-center justify-between">
            <SheetTitle className="text-base font-semibold">More CRM Tools</SheetTitle>
          </SheetHeader>

          <div className="grid grid-cols-3 gap-2 p-4">
            <Link
              href="/broadcasts"
              onClick={() => setMoreOpen(false)}
              className="flex flex-col items-center justify-center rounded-xl border border-border bg-muted/40 p-3 text-center transition-colors hover:bg-muted"
            >
              <Radio className="h-5 w-5 text-primary mb-1.5" />
              <span className="text-xs font-medium text-foreground">Broadcasts</span>
            </Link>

            <Link
              href="/automations"
              onClick={() => setMoreOpen(false)}
              className="flex flex-col items-center justify-center rounded-xl border border-border bg-muted/40 p-3 text-center transition-colors hover:bg-muted"
            >
              <Zap className="h-5 w-5 text-amber-400 mb-1.5" />
              <span className="text-xs font-medium text-foreground">Automations</span>
            </Link>

            <Link
              href="/flows"
              onClick={() => setMoreOpen(false)}
              className="flex flex-col items-center justify-center rounded-xl border border-border bg-muted/40 p-3 text-center transition-colors hover:bg-muted"
            >
              <Workflow className="h-5 w-5 text-purple-400 mb-1.5" />
              <span className="text-xs font-medium text-foreground">Flows</span>
            </Link>

            <Link
              href="/agents"
              onClick={() => setMoreOpen(false)}
              className="flex flex-col items-center justify-center rounded-xl border border-border bg-muted/40 p-3 text-center transition-colors hover:bg-muted"
            >
              <Bot className="h-5 w-5 text-blue-400 mb-1.5" />
              <span className="text-xs font-medium text-foreground">AI Agents</span>
            </Link>

            <Link
              href="/settings?tab=templates"
              onClick={() => setMoreOpen(false)}
              className="flex flex-col items-center justify-center rounded-xl border border-border bg-muted/40 p-3 text-center transition-colors hover:bg-muted"
            >
              <MessageSquare className="h-5 w-5 text-emerald-400 mb-1.5" />
              <span className="text-xs font-medium text-foreground">Templates</span>
            </Link>

            <Link
              href="/settings"
              onClick={() => setMoreOpen(false)}
              className="flex flex-col items-center justify-center rounded-xl border border-border bg-muted/40 p-3 text-center transition-colors hover:bg-muted"
            >
              <Settings className="h-5 w-5 text-muted-foreground mb-1.5" />
              <span className="text-xs font-medium text-foreground">Settings</span>
            </Link>
          </div>

          <div className="border-t border-border p-4 pt-2">
            <button
              type="button"
              onClick={() => {
                setMoreOpen(false);
                signOut();
              }}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-500/10 py-2.5 text-xs font-semibold text-red-400 hover:bg-red-500/20"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
