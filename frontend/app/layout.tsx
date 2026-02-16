import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'WasteML Compare',
  description: 'Compare Vertex AI custom classifier vs Google Vision labels',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
