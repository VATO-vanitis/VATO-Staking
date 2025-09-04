import "./globals.css";
import Providers from "./providers";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head />
      <body className="min-h-screen bg-black text-white antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
