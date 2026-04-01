import { NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import type { Adapter } from "next-auth/adapters";

export const authOptions: NextAuthOptions = {
    adapter: PrismaAdapter(prisma) as Adapter,
    session: {
        strategy: "jwt",
    },
    pages: {
        signIn: "/login",
        error: "/login",
    },
    providers: [
        CredentialsProvider({
            name: "credentials",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" },
                // Add fields commonly used for "callback" or custom behavior
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) {
                    throw new Error("Invalid credentials");
                }

                const user = await prisma.user.findUnique({
                    where: {
                        email: credentials.email,
                    },
                });

                if (!user || !user?.password) {
                    throw new Error("Invalid credentials");
                }

                const isCorrectPassword = await compare(
                    credentials.password,
                    user.password
                );

                if (!isCorrectPassword) {
                    throw new Error("Invalid credentials");
                }

                if (!user.isActive) {
                    throw new Error("Account is inactive");
                }

                // Check email verification
                if (!user.emailVerified) {
                    throw new Error("Please verify your email address before logging in. Check your inbox for the verification link.");
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
    callbacks: {
        async jwt({ token, user, trigger, session }) {
            if (trigger === "update" && session) {
                return { ...token, ...session };
            }

            if (user) {
                return {
                    ...token,
                    id: user.id,
                    role: user.role,
                    organizationId: user.organizationId,
                };
            }
            return token;
        },
        async session({ session, token }) {
            return {
                ...session,
                user: {
                    ...session.user,
                    id: token.id,
                    role: token.role,
                    organizationId: token.organizationId,
                },
            };
        },
    },
};

/**
 * Get the current session on the server
 */
export async function getSession() {
    return await getServerSession(authOptions);
}

/**
 * Get the current user from session
 */
export async function getCurrentUser() {
    const session = await getSession();

    if (!session?.user?.id) {
        return null;
    }

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: {
            organization: true,
            employee: true,
        },
    });

    return user;
}

/**
 * Require authentication - redirect to login if not authenticated
 */
export async function requireAuth() {
    const session = await getSession();

    if (!session?.user) {
        redirect("/login");
    }

    return session;
}

/**
 * Require specific role(s)
 */
export async function requireRole(allowedRoles: string[]) {
    const session = await requireAuth();

    if (!allowedRoles.includes(session.user.role)) {
        redirect("/unauthorized");
    }

    return session;
}

// ──────────────────────────────────────────────────────
// API-specific role helpers (return NextResponse, not redirect)
// ──────────────────────────────────────────────────────

export type UserRole = "super_admin" | "admin" | "hr_admin" | "manager" | "employee";

/** Roles that can manage organizational data (employees, departments, payroll, settings, etc.) */
export const HR_ADMIN_ROLES: UserRole[] = ["super_admin", "admin", "hr_admin"];

/** Roles that can approve/manage team operations */
export const MANAGER_ROLES: UserRole[] = ["super_admin", "admin", "hr_admin", "manager"];

/**
 * Get authenticated user with org context for API routes.
 * Returns { user, organizationId } or null if unauthenticated.
 */
export async function getApiUser() {
    const session = await getServerSession(authOptions);
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

/**
 * Check if a role is in the allowed list
 */
export function isRoleAllowed(role: string, allowedRoles: UserRole[]): boolean {
    return allowedRoles.includes(role as UserRole);
}

/**
 * Hash password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
    return await bcrypt.hash(password, 12);
}

/**
 * Verify password
 */
export async function verifyPassword(
    password: string,
    hashedPassword: string
): Promise<boolean> {
    return await bcrypt.compare(password, hashedPassword);
}

/**
 * Generate a cryptographically secure random token
 * Uses crypto.randomBytes() — NOT Math.random() which is predictable
 */
export function generateToken(length: number = 32): string {
    const crypto = require("crypto");
    return crypto.randomBytes(Math.ceil(length / 2)).toString("hex").slice(0, length);
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Validate password strength
 */
export function validatePassword(password: string): {
    valid: boolean;
    errors: string[];
} {
    const errors: string[] = [];

    if (password.length < 8) {
        errors.push("Password must be at least 8 characters long");
    }
    if (!/[A-Z]/.test(password)) {
        errors.push("Password must contain at least one uppercase letter");
    }
    if (!/[a-z]/.test(password)) {
        errors.push("Password must contain at least one lowercase letter");
    }
    if (!/[0-9]/.test(password)) {
        errors.push("Password must contain at least one number");
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}
