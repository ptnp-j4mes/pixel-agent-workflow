import type { Metadata } from "next";
import { Noto_Sans_Thai, Pixelify_Sans, Press_Start_2P } from "next/font/google";
import "./globals.css";

const pixelify = Pixelify_Sans({ subsets: ["latin"], variable: "--font-pixelify", weight: ["400", "500", "600", "700"] });
const pressStart = Press_Start_2P({ subsets: ["latin"], variable: "--font-press-start", weight: "400" });
const notoThai = Noto_Sans_Thai({ subsets: ["thai"], variable: "--font-thai", weight: ["400", "500", "700", "800"] });

export const metadata: Metadata = {
  title: "AI Agent Workflow Room",
  description: "Next.js scene showing an AI agent workflow with a running sprite background."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th">
      <body className={`${pixelify.variable} ${pressStart.variable} ${notoThai.variable}`}>{children}</body>
    </html>
  );
}
