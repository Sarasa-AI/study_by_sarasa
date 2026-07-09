import { Providers } from "@/components/providers";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession();
  if (!session) {
    redirect("/login");
  }
  return (
    <Providers>
      <div className="container">
        <header className="flex items-center justify-between py-4">
          <Link href="/" className="text-lg font-bold">
            آموزش بالینی
          </Link>
          <nav className="flex items-center gap-2">
            <Link href="/dashboard">
              <Button variant="secondary">داشبورد</Button>
            </Link>
            <Link href="/instructor">
              <Button variant="ghost">اساتید</Button>
            </Link>
          </nav>
        </header>
        <main className="py-4">{children}</main>
      </div>
    </Providers>
  );
}
