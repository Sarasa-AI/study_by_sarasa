import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "MVP آموزش بالینی",
  description: "پلتفرم وب‌محور آموزش تشخیص و مدیریت بیماری‌های اورژانسی",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <body className="min-h-screen bg-background text-foreground">{children}</body>
    </html>
  );
}
