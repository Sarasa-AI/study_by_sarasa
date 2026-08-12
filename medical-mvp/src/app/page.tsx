import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import {
  Activity,
  ArrowLeft,
  Brain,
  LineChart,
  Search,
  ShieldCheck,
  Stethoscope,
  Timer,
} from "lucide-react";
import { authOptions } from "@/lib/auth";
import { Button } from "@/components/ui/Button";

const features = [
  {
    icon: Brain,
    title: "هوش مصنوعی بدون توهم",
    description:
      "پاسخ‌ها بر پایه بازیابی از گایدلاین‌های معتبر مانند AAP و GINA تولید می‌شوند تا دقت بالینی حفظ شود.",
  },
  {
    icon: Timer,
    title: "شبیه‌ساز آزمون زمان‌دار",
    description:
      "آزمون‌های شبیه‌سازی‌شده به سبک بورد، با محدودیت زمانی واقعی برای تقویت سرعت و دقت تصمیم‌گیری.",
  },
  {
    icon: Search,
    title: "جستجوی مفهومی",
    description:
      "با علائم، شکایت اصلی یا کلیدواژه‌های بالینی، کیس‌های مرتبط را به‌صورت معنایی پیدا کنید.",
  },
  {
    icon: LineChart,
    title: "داشبورد تحلیلی",
    description:
      "پیشرفت، نقاط قوت و ضعف خود را در دسته‌بندی‌های مختلف پیگیری کنید و مسیر مطالعه را هدفمند کنید.",
  },
] as const;

export default async function LandingPage() {
  const session = await getServerSession(authOptions);
  if (session) {
    redirect("/home");
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-bl from-slate-50 via-white to-primary-50/50">
      <div
        className="pointer-events-none absolute inset-0 bg-grid-pattern bg-grid opacity-40"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -end-24 top-16 h-80 w-80 rounded-full bg-teal-400/15 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -start-20 bottom-40 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl"
        aria-hidden
      />

      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary-600 to-primary-800 text-white shadow-soft">
            <Activity className="h-5 w-5" strokeWidth={2.25} />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900">مدیکال MVP</p>
            <p className="text-xs text-slate-500">آمادگی هوشمند آزمون پزشکی</p>
          </div>
        </div>
        <Link
          href="/login"
          className="text-sm font-medium text-slate-600 transition-colors hover:text-primary-700"
        >
          ورود
        </Link>
      </header>

      <main className="relative z-10">
        <section className="mx-auto flex w-full max-w-6xl flex-col items-center px-4 pb-16 pt-10 text-center sm:px-6 sm:pb-20 sm:pt-16">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary-200/70 bg-white/70 px-3.5 py-1.5 text-xs font-medium text-primary-800 shadow-sm backdrop-blur-sm">
            <Stethoscope className="h-3.5 w-3.5" />
            مبتنی بر گایدلاین‌های بالینی
          </div>

          <h1 className="max-w-3xl text-3xl font-extrabold leading-relaxed tracking-tight text-slate-900 sm:text-4xl md:text-5xl md:leading-snug">
            پلتفرم هوشمند آمادگی آزمون‌های پزشکی
          </h1>

          <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg sm:leading-9">
            کیس‌های بالینی را با هوش مصنوعی مبتنی بر گایدلاین تمرین کنید، آزمون‌های زمان‌دار بدهید و
            پیشرفت خود را دقیق‌تر بسنجید.
          </p>

          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:gap-4">
            <Link href="/login">
              <Button className="min-w-[10.5rem] px-6 py-3 text-base">
                شروع رایگان
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <Link
              href="/login"
              className="text-sm font-medium text-slate-500 underline-offset-4 transition-colors hover:text-primary-700 hover:underline"
            >
              حساب دارید؟ وارد شوید
            </Link>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6 sm:pb-20">
          <div className="mb-10 text-center">
            <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">چهار رکن یادگیری بالینی</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">
              از تمرین کیس تا تحلیل عملکرد؛ همه چیز برای آمادگی واقعی آزمون طراحی شده است.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
            {features.map(({ icon: Icon, title, description }) => (
              <div key={title} className="group text-start">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary-50 text-primary-700 ring-1 ring-primary-100 transition-colors group-hover:bg-primary-100">
                  <Icon className="h-5 w-5" strokeWidth={2} />
                </div>
                <h3 className="text-base font-bold text-slate-900">{title}</h3>
                <p className="mt-2 text-sm leading-7 text-slate-600">{description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6 sm:pb-20">
          <div className="relative overflow-hidden rounded-3xl bg-login-hero px-6 py-10 text-center shadow-soft-lg sm:px-10 sm:py-12">
            <div
              className="pointer-events-none absolute inset-0 bg-grid-pattern bg-grid opacity-30"
              aria-hidden
            />
            <div className="relative z-10 mx-auto flex max-w-2xl flex-col items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 text-white backdrop-blur-sm">
                <ShieldCheck className="h-6 w-6" strokeWidth={2} />
              </div>
              <p className="text-lg font-semibold leading-8 text-white sm:text-xl sm:leading-9">
                کیس‌ها بر اساس گایدلاین‌های پزشکی تأییدشده تولید می‌شوند
              </p>
              <p className="text-sm leading-7 text-teal-50/85">
                محتوا با ارجاع به منابع معتبر بالینی ساخته شده تا یادگیری شما قابل اعتماد و نزدیک به
                استانداردهای واقعی باشد.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-slate-200/70 bg-white/50 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 text-sm text-slate-500 sm:flex-row sm:px-6">
          <p>© {new Date().getFullYear()} مدیکال MVP. تمامی حقوق محفوظ است.</p>
          <Link href="/login" className="font-medium text-primary-700 hover:text-primary-800">
            ورود به حساب کاربری
          </Link>
        </div>
      </footer>
    </div>
  );
}
