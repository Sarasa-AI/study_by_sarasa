import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";

const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Simple Login",
      credentials: {
        name: { label: "نام", type: "text" },
        studentCode: { label: "کد دانشجویی", type: "text" },
        role: { label: "نقش", type: "text" },
      },
      async authorize(credentials) {
        const name = (credentials?.name || "").trim();
        const studentCode = (credentials?.studentCode || "").trim() || null;
        const role = credentials?.role === "INSTRUCTOR" ? "INSTRUCTOR" : "STUDENT";
        if (!name) return null;
        const user = await prisma.user.upsert({
          where: studentCode ? { studentCode } : { id: "no-id" },
          update: { name, role },
          create: {
            name,
            role,
            studentCode: studentCode ?? null,
          },
        }).catch(async () => {
          // Fallback when studentCode is null or unique constraint fails
          const existing = await prisma.user.findFirst({
            where: studentCode ? { studentCode } : { name },
          });
          if (existing) {
            return prisma.user.update({
              where: { id: existing.id },
              data: { name, role },
            });
          }
          return prisma.user.create({
            data: { name, role, studentCode: studentCode ?? null },
          });
        });
        return { id: user.id, name: user.name, role: user.role, studentCode: user.studentCode ?? undefined } as any;
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as any).id;
        token.role = (user as any).role;
        token.studentCode = (user as any).studentCode;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
        (session.user as any).studentCode = token.studentCode;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
