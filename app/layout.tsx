import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Accelerator Docs RAG — Live Console",
  description:
    "Live console for an RBAC-enforced MCP documentation server: health, Prometheus metrics, and a side-by-side role-based retrieval playground.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
        <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur sticky top-0 z-10">
          <nav className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-4">
            <Link href="/" className="font-semibold tracking-tight">
              <span className="text-sky-600 dark:text-sky-400 font-mono">ATS</span>{" "}
              Docs RAG Console
            </Link>
            <div className="flex items-center gap-4 text-sm text-zinc-600 dark:text-zinc-400">
              <Link
                href="/"
                className="hover:text-zinc-900 dark:hover:text-zinc-100"
              >
                Overview
              </Link>
              <Link
                href="/playground"
                className="hover:text-zinc-900 dark:hover:text-zinc-100"
              >
                RBAC Playground
              </Link>
            </div>
            <div className="ml-auto flex items-center gap-4 text-sm text-zinc-500 dark:text-zinc-500">
              <a
                href="https://github.com/HoodieYlya13/confluence-bot"
                target="_blank"
                rel="noreferrer"
                className="hover:text-zinc-900 dark:hover:text-zinc-100"
              >
                GitHub ↗
              </a>
            </div>
          </nav>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
          {children}
        </main>
        <footer className="border-t border-zinc-200 dark:border-zinc-800 py-6 text-center text-xs text-zinc-500">
          Frontend console for an MCP server with 4-layer RBAC — the engineering
          lives server-side, this is the window into it.
        </footer>
      </body>
    </html>
  );
}
