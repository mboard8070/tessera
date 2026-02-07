"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Search,
  Library,
  Share2,
  Lightbulb,
  BookOpen,
} from "lucide-react";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Search", href: "/search", icon: Search },
  { name: "Collections", href: "/collections", icon: Library },
  { name: "Graph", href: "/graph", icon: Share2 },
  { name: "Knowledge", href: "/knowledge", icon: Lightbulb },
];

export function TopNav() {
  const pathname = usePathname();

  return (
    <header className="border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="flex items-center justify-between px-6 py-3 border-b border-zinc-800/50">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/20">
            <BookOpen className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-white text-lg tracking-tight">
              Lit Review
              <span className="text-zinc-500 font-normal text-sm ml-2">Agent</span>
            </h1>
          </div>
        </div>
        <LlmStatusBadge />
      </div>

      <nav className="flex items-center gap-1 px-4 overflow-x-auto">
        {navigation.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all border-b-2 whitespace-nowrap",
                isActive
                  ? "border-emerald-500 text-emerald-400 bg-emerald-500/5"
                  : "border-transparent text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.name}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}

function LlmStatusBadge() {
  const [online, setOnline] = useState<boolean | null>(null);
  const [model, setModel] = useState<string>("");

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch("/api/llm/status");
        const data = await res.json();
        setOnline(data.online);
        if (data.model) setModel(data.model);
      } catch {
        setOnline(false);
      }
    };
    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          "h-2 w-2 rounded-full",
          online === null ? "bg-zinc-500" : online ? "bg-emerald-500 animate-pulse" : "bg-red-500"
        )}
      />
      <span className={cn("text-xs", online ? "text-emerald-400" : "text-zinc-500")}>
        {model || "Nemotron"}
      </span>
    </div>
  );
}
