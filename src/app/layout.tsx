import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Video",
  description: "Video oynatıcı",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" className="h-full">
      <body className="m-0 h-full overflow-hidden bg-black">{children}</body>
    </html>
  );
}
