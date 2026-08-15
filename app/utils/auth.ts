import NextAuth from "next-auth";
import { authConfig } from "./authOptions";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  secret: process.env.NEXTAUTH_SECRET,
  trustHost: true, // Required for Next.js 15+
});