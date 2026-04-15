import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import Apple from "next-auth/providers/apple";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/lib/db";
import { users, accounts, sessions, verificationTokens } from "@/db/schema";

const providers: NextAuthConfig["providers"] = [
  Google({
    clientId: process.env.AUTH_GOOGLE_ID ?? "",
    clientSecret: process.env.AUTH_GOOGLE_SECRET ?? "",
  }),
  GitHub({
    clientId: process.env.AUTH_GITHUB_ID ?? "",
    clientSecret: process.env.AUTH_GITHUB_SECRET ?? "",
  }),
];

if (process.env.AUTH_APPLE_ID && process.env.AUTH_APPLE_SECRET) {
  providers.push(
    Apple({
      clientId: process.env.AUTH_APPLE_ID,
      clientSecret: process.env.AUTH_APPLE_SECRET,
    }),
  );
}

export const authConfig = {
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  providers,
  session: {
    strategy: "database",
  },
  pages: {
    signIn: "/",
  },
  trustHost: true,
} satisfies NextAuthConfig;

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
