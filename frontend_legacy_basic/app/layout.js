import "./globals.css";

export const metadata = {
  title: "EcoSort Vision",
  description: "Waste segregation assistant UI",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
