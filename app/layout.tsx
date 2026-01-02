import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono, Cinzel } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })
const _cinzel = Cinzel({ subsets: ["latin"], weight: ["400", "700"] })

export const metadata: Metadata = {
  title: "Hide and Seek Cards - A Family Card Game",
  description:
    "A high-stakes turn-based card elimination game where strategy and luck collide. Created by kids, enjoyed by everyone. Play online with friends or against bots!",
  generator: "v0.app",
  keywords: ["card game", "multiplayer", "family game", "strategy game", "elimination game", "online game"],
  authors: [{ name: "Hide and Seek Cards" }],
  creator: "Hide and Seek Cards",
  publisher: "Hide and Seek Cards",
  metadataBase: new URL("https://hide-and-seek-cards.vercel.app"),
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://hide-and-seek-cards.vercel.app",
    siteName: "Hide and Seek Cards",
    title: "Hide and Seek Cards - A Family Card Game",
    description:
      "A high-stakes turn-based card elimination game where strategy and luck collide. Created by kids on a family camping trip, now playable online!",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Hide and Seek Cards - A mysterious card game of strategy and elimination",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Hide and Seek Cards - A Family Card Game",
    description:
      "A high-stakes turn-based card elimination game. Choose your target, pick a card, but beware - draw your own card and you're out!",
    images: ["/og-image.jpg"],
    creator: "@hideandseek",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
  icons: {
    icon: [
      {
        url: "/icon-light-32x32.jpg",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/icon-dark-32x32.jpg",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "/icon.svg",
        type: "image/svg+xml",
      },
    ],
    apple: "/apple-icon.jpg",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`font-sans antialiased`}>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
