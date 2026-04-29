import type { Metadata } from "next"
import "./globals.css"
import { AuthProvider } from "@/components/providers/AuthProvider"
import { Toaster } from "@/components/ui/toaster"

// All pages require authentication/dynamic data — disable static prerendering
export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "TeamPulse AI - Team Performance Intelligence",
  description: "AI-powered team performance tracking and insights",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="h-full bg-background text-foreground font-sans">
        <AuthProvider>
          {children}
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  )
}
