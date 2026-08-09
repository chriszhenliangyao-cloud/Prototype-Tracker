import type { Metadata } from "next";
import { headers } from "next/headers";
import { GlobalHeader } from "@/components/GlobalHeader";
import { getCurrentSession } from "@/lib/auth/server";
import { APP_DESCRIPTION, APP_NAME } from "@/lib/branding";
import { getNavigationItems } from "@/lib/navigation";
import "./globals.css";

export const metadata: Metadata = {
  title: APP_NAME,
  description: APP_DESCRIPTION
};

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const requestHeaders = await headers();
  const isPlatformEmbed = requestHeaders.get("sec-fetch-dest") === "iframe";
  const session = await getCurrentSession();
  const navigationItems = getNavigationItems(session?.role ?? "VIEWER");

  return (
    <html lang="en">
      <body className={isPlatformEmbed ? "platform-embed" : undefined}>
        <div className="min-h-screen">
          {isPlatformEmbed ? null : (
            <GlobalHeader navigationItems={navigationItems} session={session} />
          )}
          <main
            className={
              isPlatformEmbed
                ? "w-full px-3 py-3"
                : "mx-auto w-full max-w-[1800px] px-4 py-6 sm:px-5"
            }
          >
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
