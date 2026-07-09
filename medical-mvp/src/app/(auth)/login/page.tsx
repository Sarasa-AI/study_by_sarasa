 "use client";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [name, setName] = useState("");
  const [studentCode, setStudentCode] = useState("");
  const [role, setRole] = useState<"STUDENT" | "INSTRUCTOR">("STUDENT");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await signIn("credentials", {
      name,
      studentCode,
      role,
      redirect: false,
    });
    setLoading(false);
    if (res?.ok) {
      router.push("/");
    } else {
      alert("ورود نامعتبر");
    }
  }

  return (
    <div className="container flex min-h-screen items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <h1 className="text-xl font-bold">ورود به پلتفرم آموزش بالینی</h1>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm">نام</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="نام خود را وارد کنید" required />
            </div>
            <div>
              <label className="mb-1 block text-sm">کد دانشجویی (اختیاری)</label>
              <Input
                value={studentCode}
                onChange={(e) => setStudentCode(e.target.value)}
                placeholder="مثال: 4012345"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm">نقش</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className={`rounded-xl border px-3 py-2 text-sm ${role === "STUDENT" ? "border-teal-600 bg-teal-50 text-teal-700" : "border-border"}`}
                  onClick={() => setRole("STUDENT")}
                >
                  دانشجو
                </button>
                <button
                  type="button"
                  className={`rounded-xl border px-3 py-2 text-sm ${role === "INSTRUCTOR" ? "border-teal-600 bg-teal-50 text-teal-700" : "border-border"}`}
                  onClick={() => setRole("INSTRUCTOR")}
                >
                  استاد
                </button>
              </div>
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "در حال ورود..." : "ورود"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
