/**
 * Auth.js v5 Configuration — Edge-Safe Base Config
 *
 * This file contains ONLY the auth config that is safe to import
 * in Edge Runtime (middleware). NO Prisma adapter or Node.js APIs.
 *
 * The full auth config (with PrismaAdapter) lives in auth.ts.
 * The middleware imports from THIS file to avoid Edge Runtime errors.
 */

import Credentials from "next-auth/providers/credentials";
import type { NextAuthConfig } from "next-auth";

export const authConfig: NextAuthConfig = {
    session: {
        strategy: "jwt",
    },
    pages: {
        signIn: "/login",
        error: "/login",
    },
    providers: [
        // Credentials provider is configured with authorize() in auth.ts
        // Here we just declare it for middleware JWT decoding
        Credentials({
            id: "credentials",
            name: "credentials",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" },
            },
            // authorize is ONLY called during sign-in (not middleware)
            // The full implementation is in auth.ts
            authorize: () => null,
        }),
    ],
    callbacks: {
        jwt({ token, user, trigger, session }: any) {
            if (trigger === "update" && session) {
                return { ...token, ...session };
            }
            if (user) {
                token.id = user.id;
                token.role = user.role;
                token.organizationId = user.organizationId;
                token.organizationStatus = user.organizationStatus;
                token.sessionVersion = user.sessionVersion;
            }
            return token;
        },
        session({ session, token }: any) {
            return {
                ...session,
                user: {
                    ...session.user,
                    id: token.id as string,
                    role: token.role as string,
                    organizationId: token.organizationId as string | undefined,
                    organizationStatus: token.organizationStatus as string | undefined,
                    sessionVersion: typeof token.sessionVersion === "number" ? token.sessionVersion : 0,
                },
            };
        },
    },
};
