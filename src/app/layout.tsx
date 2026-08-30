import type { Metadata, Viewport } from "next";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Calm } from "@/components/fx/calm";

// Field Notes is set entirely in one monospace face — see DESIGN.md.
const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "Evergreen",
  description: "Grow your tree by saving energy.",
};

export const viewport: Viewport = {
  themeColor: "#edefe6",
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${jetbrains.variable} h-full antialiased`}>
      <body className="mx-auto flex min-h-full w-full max-w-md flex-col">
        <Calm>{children}</Calm>
      </body>
    </html>
  );
}
