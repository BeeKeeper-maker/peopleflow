"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Mail, ArrowRight, ArrowLeft, Loader2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";

export default function ForgotPasswordPage() {
    const { addToast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [email, setEmail] = useState("");
    const [error, setError] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (!email) {
            setError("Email is required");
            return;
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            setError("Please enter a valid email address");
            return;
        }

        setIsLoading(true);

        try {
            const res = await fetch("/api/auth/forgot-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
            });

            const data = await res.json();

            if (res.ok) {
                setIsSubmitted(true);
            } else {
                addToast({
                    type: "error",
                    title: "Error",
                    description: data.error || "Something went wrong",
                });
            }
        } catch {
            addToast({
                type: "error",
                title: "Error",
                description: "Failed to send request. Please try again.",
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#0A0A0F] p-4">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="w-full max-w-md"
            >
                {/* Back to Login */}
                <Link
                    href="/login"
                    className="inline-flex items-center gap-2 text-white/40 hover:text-white/60 transition-colors mb-8"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Login
                </Link>

                {!isSubmitted ? (
                    <>
                        <div className="text-center mb-8">
                            <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mb-4">
                                <Mail className="h-8 w-8 text-white" />
                            </div>
                            <h2 className="text-2xl font-bold text-white mb-2">
                                Forgot Your Password?
                            </h2>
                            <p className="text-white/60">
                                Enter your email address and we&apos;ll send you a link to reset your password.
                            </p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-5">
                            <Input
                                label="Email Address"
                                type="email"
                                placeholder="your@email.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                error={error}
                                leftIcon={<Mail className="h-5 w-5" />}
                                autoComplete="email"
                                disabled={isLoading}
                            />

                            <Button
                                type="submit"
                                className="w-full h-12"
                                isLoading={isLoading}
                            >
                                {!isLoading && (
                                    <>
                                        Send Reset Link
                                        <ArrowRight className="h-5 w-5" />
                                    </>
                                )}
                            </Button>
                        </form>
                    </>
                ) : (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="text-center"
                    >
                        <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center mb-4">
                            <CheckCircle className="h-8 w-8 text-white" />
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-2">
                            Check Your Email
                        </h2>
                        <p className="text-white/60 mb-6">
                            If an account exists with <strong className="text-white">{email}</strong>,
                            you&apos;ll receive a password reset link shortly.
                        </p>
                        <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-white/50 text-sm mb-6">
                            <p>📧 Didn&apos;t receive the email? Check your spam folder.</p>
                            <p className="mt-2">The link expires in <strong className="text-white/70">1 hour</strong>.</p>
                        </div>
                        <Button
                            variant="outline"
                            className="w-full"
                            onClick={() => {
                                setIsSubmitted(false);
                                setEmail("");
                            }}
                        >
                            Try Another Email
                        </Button>
                    </motion.div>
                )}
            </motion.div>
        </div>
    );
}
