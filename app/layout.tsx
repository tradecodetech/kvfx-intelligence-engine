import "./globals.css";

export const metadata = {
  title: "KVFX Intelligence Engine",
  description: "AI-powered trade intelligence — bias, structure, confidence, plan.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
