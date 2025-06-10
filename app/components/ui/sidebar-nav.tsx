"use client"

import type React from "react"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { BarChart3, Command, Home, Map, LogOut } from "lucide-react"

interface SidebarNavProps extends React.HTMLAttributes<HTMLElement> {
  onLogout: () => void
}

export function SidebarNav({ className, onLogout, ...props }: SidebarNavProps) {
  const pathname = usePathname()

  const routes = [
    {
      href: "/",
      icon: Home,
      label: "Dashboard",
      active: pathname === "/",
    },
    {
      href: "/analytics",
      icon: BarChart3,
      label: "Analytics",
      active: pathname === "/analytics",
    },
    {
      href: "/map",
      icon: Map,
      label: "Map View",
      active: pathname === "/map",
    },
    {
      href: "/commands",
      icon: Command,
      label: "Commands",
      active: pathname === "/commands",
    },
  ]

  return (
    <nav className={cn("flex flex-col space-y-1", className)} {...props}>
      <div className="px-3 py-2">
        <h2 className="mb-2 px-4 text-lg font-semibold tracking-tight">Telematics Hub</h2>
        <div className="space-y-1">
          {routes.map((route) => (
            <Link
              key={route.href}
              href={route.href}
              className={cn(
                "flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors",
                route.active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent",
              )}
            >
              <route.icon className="mr-2 h-4 w-4" />
              {route.label}
            </Link>
          ))}
        </div>
      </div>
      <div className="px-3 py-2 mt-auto">
        <button
          onClick={onLogout}
          className="flex w-full items-center px-3 py-2 text-sm font-medium rounded-md text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </button>
      </div>
    </nav>
  )
}
