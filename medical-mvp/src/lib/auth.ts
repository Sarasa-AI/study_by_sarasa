import { Role } from "@prisma/client";
import { getServerSession, type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export type SessionUser = {
  id: string;
  name?: string | null;
  role: Role;
  studentCode?: string | null;
};

export function parseInstructorCodes(raw = process.env.INSTRUCTOR_CODES): Set<string> {
  if (!raw?.trim()) return new Set();
  return new Set(
    raw
      .split(",")
      .map((code) => code.trim().toUpperCase())
      .filter(Boolean),
  );
}

export function resolveRoleFromStudentCode(studentCode: string | null | undefined): Role {
  if (!studentCode?.trim()) return Role.STUDENT;
  const allowlist = parseInstructorCodes();
  return allowlist.has(studentCode.trim().toUpperCase()) ? Role.INSTRUCTOR : Role.STUDENT;
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Simple Login",
      credentials: {
        name: { label: "نام", type: "text" },
        studentCode: { label: "کد دانشجویی", type: "text" },
      },
      async authorize(credentials) {
        const name = (credentials?.name || "").trim();
        const studentCode = (credentials?.studentCode || "").trim() || null;
        const role = resolveRoleFromStudentCode(studentCode);
        if (!name) return null;

        const user = await prisma.user
          .upsert({
            where: studentCode ? { studentCode } : { id: "no-id" },
            update: { name },
            create: {
              name,
              role,
              studentCode: studentCode ?? null,
            },
          })
          .catch(async () => {
            // Fallback when studentCode is null or unique constraint fails
            const existing = await prisma.user.findFirst({
              where: studentCode ? { studentCode } : { name },
            });
            if (existing) {
              return prisma.user.update({
                where: { id: existing.id },
                data: { name },
              });
            }
            return prisma.user.create({
              data: { name, role, studentCode: studentCode ?? null },
            });
          });

        return {
          id: user.id,
          name: user.name,
          role: user.role,
          studentCode: user.studentCode ?? undefined,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.studentCode = user.studentCode;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = (token.role as Role) ?? Role.STUDENT;
        session.user.studentCode = token.studentCode as string | undefined;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
};

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  return {
    id: session.user.id,
    name: session.user.name,
    role: session.user.role ?? Role.STUDENT,
    studentCode: session.user.studentCode,
  };
}

export async function requireInstructor(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }
  if (user.role !== Role.INSTRUCTOR) {
    redirect("/dashboard");
  }
  return user;
}

export async function requireInstructorApi(): Promise<SessionUser | null> {
  const user = await getSessionUser();
  if (!user || user.role !== Role.INSTRUCTOR) return null;
  return user;
}
