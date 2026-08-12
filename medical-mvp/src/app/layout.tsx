import "./globals.css";
import type { Metadata } from "next";
import { Inter, Vazirmatn } from "next/font/google";
import { Providers } from "@/components/providers";
import { getDirection } from "@/locales";
import { getRequestLocale } from "@/lib/locale-server";

const vazirmatn = Vazirmatn({
  subsets: ["arabic", "latin"],
  variable: "--font-vazirmatn",
  display: "swap",
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "مدیکال MVP | شبیه‌ساز هوشمند آزمون پزشکی",
  description:
    "پلتفرم آمادگی آزمون‌های پزشکی با هوش مصنوعی مبتنی بر گایدلاین، شبیه‌ساز زمان‌دار، جستجوی مفهومی و داشبورد تحلیلی",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = getRequestLocale();
  const dir = getDirection(locale);

  return (
    <html
      lang={locale}
      dir={dir}
      data-locale={locale}
      className={`${vazirmatn.variable} ${inter.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <Providers locale={locale}>{children}</Providers>
      </body>
    </html>
  );
}
