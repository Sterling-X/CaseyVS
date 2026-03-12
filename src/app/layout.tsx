import type { Metadata } from "next";
import { IBM_Plex_Mono, Manrope } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const sans = Manrope({
  subsets: ["latin"],
  variable: "--font-sans",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Casey Visibility Reporting Platform",
  description: "Reusable monthly SEO visibility reporting operations app",
};

const navItems = [
  { href: "/", label: "Workspace" },
  { href: "/imports", label: "Import Center" },
  { href: "/keywords", label: "Keywords" },
  { href: "/competitors", label: "Competitors" },
  { href: "/exclusions", label: "Exclusions" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/qa", label: "QA" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${sans.variable} ${mono.variable} min-h-screen bg-stone-50 font-sans text-stone-900 antialiased`}>
        <header className="border-b border-stone-200 bg-white/95 backdrop-blur">
          <div className="mx-auto flex w-full max-w-[1440px] items-center justify-between gap-4 px-6 py-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">CaseyVS</p>
              <h1 className="text-sm font-semibold">SEO Visibility Reporting Platform</h1>
            </div>
            <nav className="flex flex-wrap items-center gap-2 text-sm">
              {navItems.map((item) => (
                <Link key={item.href} href={item.href} className="rounded-md px-3 py-1.5 text-stone-700 hover:bg-stone-100">
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1440px] px-6 py-6">{children}</main>
      </body>
    </html>
  );
}
