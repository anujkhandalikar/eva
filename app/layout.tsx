import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "chotu",
  description: "Background task execution",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <body className="h-full overflow-hidden flex flex-col">{children}</body>
    </html>
  );
}
