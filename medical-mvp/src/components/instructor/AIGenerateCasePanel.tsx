"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";

export function AIGenerateCasePanel() {
  return (
    <Card className="md:col-span-2">
      <CardHeader>
        <h2 className="font-semibold">تولید کیس با هوش مصنوعی</h2>
        <p className="text-sm text-slate-600">
          موضوع بالینی را وارد کنید، پیش‌نویس کامل (نکات آموزشی، MCQ و استدلال بالینی) را بررسی کنید و سپس ذخیره یا منتشر کنید.
        </p>
      </CardHeader>
      <CardContent>
        <Link href="/instructor/cases/ai-generate">
          <Button type="button" className="inline-flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            تولید کیس با AI
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
