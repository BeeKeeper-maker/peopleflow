/**
 * PeopleFlow Authentication — Auth.js v5 (Tenant Plane)
 *
 * Full auth config with PrismaAdapter. This is the Node.js-only version.
 * For Edge Runtime (middleware), use auth.config.ts instead.
 *
 * Exports:
 *   - auth()    — get session in Server Components / API routes
 *   - handlers  — GET/POST for /api/auth/[...nextauth]
 *   - signIn()  — programmatic sign-in
 *   - signOut() — programmatic sign-out
 */

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { compare } from "bcryptjs";
import bcrypt from "bcryptjs";
import type { DefaultSession } from "next-auth";
import { authConfig } from "@/lib/auth.config";

// ── Type Augmentation ────────────────────────────────────────────

declare module "next-auth" {
    interface Session {
        user: {
            id: string;
            role: string;
            organizationId?: string;
        } & DefaultSession["user"];
    }

    interface User {
        role: string;
        organizationId?: string;
    }

    interface JWT {
        id?: string;
        role?: string;
        organizationId?: string;
    }
}

// ── Auth.js v5 Configuration ─────────────────────────────────────

export const { handlers, auth, signIn, signOut } = NextAuth({
    ...authConfig,
    adapter: PrismaAdapter(prisma) as any,
    providers: [
        Credentials({
            id: "credentials",
            name: "credentials",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" },
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) {
                    throw new Error("Invalid credentials");
                }

                const user = await prisma.user.findUnique({
                    where: { email: credentials.email as string },
                });

                if (!user || !user.password) {
                    throw new Error("Invalid credentials");
                }

                const isCorrectPassword = await compare(
                    credentials.password as string,
                    user.password
                );

                if (!isCorrectPassword) {
                    throw new Error("Invalid credentials");
                }

                if (!user.isActive) {
                    throw new Error("Account is inactive");
                }

                if (!user.emailVerified) {
                    throw new Error("Please verify your email address before logging in.");
                }

                return {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    organizationId: user.organizationId || undefined,
                };
            },
        }),
    ],
});

// ── Helper Exports (backward compat) ─────────────────────────────

export type UserRole = "super_admin" | "admin" | "hr_admin" | "manager" | "employee";
export const HR_ADMIN_ROLES: UserRole[] = ["super_admin", "admin", "hr_admin"];
export const MANAGER_ROLES: UserRole[] = ["super_admin", "admin", "hr_admin", "manager"];

/** @deprecated Use `auth()` directly */
export async function getSession() {
    return await auth();
}

export async function getCurrentUser() {
    const session = await auth();
    if (!session?.user?.id) return null;
    return prisma.user.findUnique({
        where: { id: session.user.id },
        include: { organization: true, employee: true },
    });
}

/**
 * Get authenticated user with org context for API routes.
 */
export async function getApiUser() {
    const session = await auth();
    if (!session?.user?.email) return null;

    const user = await prisma.user.findUnique({
        where: { email: session.user.email },
    });

    if (!user?.organizationId) return null;

    return {
        user,
        organizationId: user.organizationId,
        role: user.role as UserRole,
    };
}

export function isRoleAllowed(role: string, allowedRoles: UserRole[]): boolean {
    return allowedRoles.includes(role as UserRole);
}

export async function hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
}

export function generateToken(length: number = 32): string {
    const crypto = require("crypto");
    return crypto.randomBytes(Math.ceil(length / 2)).toString("hex").slice(0, length);
}

export function isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validatePassword(password: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (password.length < 8) errors.push("Password must be at least 8 characters long");
    if (!/[A-Z]/.test(password)) errors.push("Password must contain at least one uppercase letter");
    if (!/[a-z]/.test(password)) errors.push("Password must contain at least one lowercase letter");
    if (!/[0-9]/.test(password)) errors.push("Password must contain at least one number");
    return { valid: errors.length === 0, errors };
}
