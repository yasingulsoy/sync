import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Video",
  description: "Video oynatıcı",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "overlays-content",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" className="h-dvh min-h-dvh">
      <body className="m-0 h-dvh min-h-dvh w-full max-w-[100vw] overflow-hidden bg-black">
        {children}
      </body>
    </html>
  );
}
