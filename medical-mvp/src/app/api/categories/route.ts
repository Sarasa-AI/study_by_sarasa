import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const categories = await prisma.category.findMany({
    orderBy: { orderIndex: "asc" },
    select: { id: true, name: true, slug: true, description: true, icon: true },
  });
  return NextResponse.json(categories);
}
