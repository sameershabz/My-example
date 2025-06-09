"use client"

import { useAuth } from "react-oidc-context"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu, X, User, LogOut } from "lucide-react"
import { useState } from "react"

export default function Header() {
  const auth = useAuth()
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const signOutRedirect = () => {
    const clientId = "79ufsa70isosab15kpcmlm628d"
    const logoutUri = "https://telematicshub.vercel.app/logout-callback"
    const cognitoDomain = "https://us-east-1dlb9dc7ko.auth.us-east-1.amazoncognito.com"
    window.location.href = `${cognitoDomain}/logout?client_id=${clientId}&logout_uri=${encodeURIComponent(logoutUri)}`
  }

  const navigation = [
    { name: "Dashboard", href: "/" },
    { name: "Vehicle Map", href: "/map" },
    { name: "Analytics", href: "/analytics" },
    { name: "Commands", href: "/commands" },
  ]

  return (
    <header className="bg-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <Link href="/" className="text-xl font-bold text-blue-600">
                Telematics Hub
              </Link>
            </div>
            <nav className="hidden md:ml-6 md:flex md:space-x-8">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                    pathname === item.href
                      ? "border-blue-500 text-gray-900"
                      : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                  }`}
                >
                  {item.name}
                </Link>
              ))}
            </nav>
          </div>

          <div className="hidden md:ml-6 md:flex md:items-center">
            <div className="flex items-center">
              {auth.user && (
                <div className="flex items-center mr-4">
                  <User className="h-5 w-5 text-gray-400 mr-2" />
                  <span className="text-sm text-gray-700">{auth.user.profile.email || "User"}</span>
                </div>
              )}
              <button
                onClick={signOutRedirect}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </button>
            </div>
          </div>

          <div className="flex items-center md:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
            >
              {mobileMenuOpen ? <X className="block h-6 w-6" /> : <Menu className="block h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden">
          <div className="pt-2 pb-3 space-y-1">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={`block pl-3 pr-4 py-2 border-l-4 text-base font-medium ${
                  pathname === item.href
                    ? "bg-blue-50 border-blue-500 text-blue-700"
                    : "border-transparent text-gray-500 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-700"
                }`}
                onClick={() => setMobileMenuOpen(false)}
              >
                {item.name}
              </Link>
            ))}
          </div>
          <div className="pt-4 pb-3 border-t border-gray-200">
            {auth.user && (
              <div className="flex items-center px-4">
                <div className="flex-shrink-0">
                  <User className="h-10 w-10 rounded-full bg-gray-100 p-2" />
                </div>
                <div className="ml-3">
                  <div className="text-base font-medium text-gray-800">{auth.user.profile.name || "User"}</div>
                  <div className="text-sm font-medium text-gray-500">{auth.user.profile.email || ""}</div>
                </div>
              </div>
            )}
            <div className="mt-3 space-y-1">
              <button
                onClick={signOutRedirect}
                className="block w-full text-left px-4 py-2 text-base font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-100"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
