import { Providers } from "@/components/providers";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/login");
  }

  const isInstructor = session.user.role === "INSTRUCTOR";

  return (
    <Providers>
      <div className="container">
        <header className="print:hidden flex items-center justify-between py-4">
          <Link href="/" className="text-lg font-bold">
            آموزش بالینی
          </Link>
          <nav className="flex items-center gap-2">
            <Link href="/dashboard">
              <Button variant="secondary">داشبورد</Button>
            </Link>
            <Link href="/analytics">
              <Button variant="ghost">تحلیل عملکرد</Button>
            </Link>
            <Link href="/leaderboard">
              <Button variant="ghost">جدول رقابتی</Button>
            </Link>
            <Link href="/library">
              <Button variant="ghost">کتابخانه و دانش</Button>
            </Link>
            <Link href="/flashcards">
              <Button variant="ghost">فلش‌کارت‌ها</Button>
            </Link>
            <Link href="/exam">
              <Button variant="ghost">شبیه‌ساز آزمون</Button>
            </Link>
            <Link href="/notes">
              <Button variant="ghost">خلاصه و جزوه‌ها</Button>
            </Link>
            <Link href="/bookmarks">
              <Button variant="ghost">نشان‌شده‌ها و یادداشت‌ها</Button>
            </Link>
            {isInstructor && (
              <Link href="/instructor">
                <Button variant="ghost">اساتید</Button>
              </Link>
            )}
          </nav>
        </header>
        <main className="py-4">{children}</main>
      </div>
    </Providers>
  );
}
