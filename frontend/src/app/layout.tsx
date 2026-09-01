import type { Metadata } from "next";
import { IBM_Plex_Sans_Thai } from "next/font/google";
import { Toaster } from "@/components/ui/toast";
import "./globals.css";

const ibmPlexSansThai = IBM_Plex_Sans_Thai({
  variable: "--font-ibm-plex-sans-thai",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "getownly - ตลาดกลางคอร์สเรียนออนไลน์",
    template: "%s | getownly",
  },
  description: "แพลตฟอร์มตลาดกลางสำหรับซื้อขายคอร์สเรียนออนไลน์",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <body className={`${ibmPlexSansThai.variable} antialiased`}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
