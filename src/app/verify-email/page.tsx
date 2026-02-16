"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { CheckCircle, XCircle, Loader2, ArrowRight, Mail, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";

export default function VerifyEmailPage() {
    const searchParams = useSearchParams();
    const token = searchParams.get("token");
    const { addToast } = useToast();

    const [status, setStatus] = useState<"loading" | "success" | "error" | "no-token">(
        token ? "loading" : "no-token"
    );
    const [errorMessage, setErrorMessage] = useState("");
    const [resendEmail, setResendEmail] = useState("");
    const [isResending, setIsResending] = useState(false);
    const [resendSuccess, setResendSuccess] = useState(false);

    useEffect(() => {
        const verifyEmail = async () => {
            if (!token) return;

            try {
                const res = await fetch(`/api/auth/verify-email?token=${token}`);
                const data = await res.json();

                if (res.ok) {
                    setStatus("success");
                } else {
                    setStatus("error");
                    setErrorMessage(data.error || "Verification failed");
                }
            } catch {
                setStatus("error");
                setErrorMessage("An error occurred during verification");
            }
        };

        verifyEmail();
    }, [token]);

    const handleResend = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!resendEmail) return;

        setIsResending(true);

        try {
            const res = await fetch("/api/auth/verify-email", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: resendEmail }),
            });

            if (res.ok) {
                setResendSuccess(true);
                addToast({
                    type: "success",
                    title: "Email Sent",
                    description: "Check your inbox for the verification link.",
                });
            } else {
                const data = await res.json();
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
                description: "Failed to resend. Please try again.",
            });
        } finally {
            setIsResending(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#0A0A0F] p-4">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="w-full max-w-md text-center"
            >
                {/* Loading */}
                {status === "loading" && (
                    <>
                        <Loader2 className="h-12 w-12 text-blue-500 animate-spin mx-auto mb-4" />
                        <h2 className="text-2xl font-bold text-white mb-2">Verifying Your Email...</h2>
                        <p className="text-white/60">Please wait a moment.</p>
                    </>
                )}

                {/* Success */}
                {status === "success" && (
                    <>
                        <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center mb-4">
                            <CheckCircle className="h-8 w-8 text-white" />
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-2">Email Verified! ✅</h2>
                        <p className="text-white/60 mb-6">
                            Your email has been verified successfully. You can now log in to your account.
                        </p>
                        <Link href="/login">
                            <Button className="w-full h-12">
                                Go to Login
                                <ArrowRight className="h-5 w-5" />
                            </Button>
                        </Link>
                    </>
                )}

                {/* Error */}
                {status === "error" && (
                    <>
                        <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center mb-4">
                            <XCircle className="h-8 w-8 text-white" />
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-2">Verification Failed</h2>
                        <p className="text-white/60 mb-6">{errorMessage}</p>

                        {/* Resend form */}
                        {!resendSuccess ? (
                            <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-left">
                                <p className="text-white/50 text-sm mb-3">
                                    Need a new verification link?
                                </p>
                                <form onSubmit={handleResend} className="space-y-3">
                                    <Input
                                        type="email"
                                        placeholder="your@email.com"
                                        value={resendEmail}
                                        onChange={(e) => setResendEmail(e.target.value)}
                                        leftIcon={<Mail className="h-5 w-5" />}
                                        disabled={isResending}
                                    />
                                    <Button
                                        type="submit"
                                        variant="outline"
                                        className="w-full"
                                        isLoading={isResending}
                                    >
                                        {!isResending && (
                                            <>
                                                <RefreshCw className="h-4 w-4" />
                                                Resend Verification
                                            </>
                                        )}
                                    </Button>
                                </form>
                            </div>
                        ) : (
                            <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
                                <p className="text-green-400 text-sm">
                                    ✅ Verification email sent! Check your inbox.
                                </p>
                            </div>
                        )}
                    </>
                )}

                {/* No token (landing page after registration) */}
                {status === "no-token" && (
                    <>
                        <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mb-4">
                            <Mail className="h-8 w-8 text-white" />
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-2">Check Your Email 📧</h2>
                        <p className="text-white/60 mb-6">
                            We&apos;ve sent a verification link to your email address.
                            Please click the link to activate your account.
                        </p>

                        <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-white/50 text-sm mb-6 text-left space-y-2">
                            <p>📬 Check your inbox (and spam folder)</p>
                            <p>⏱️ The link expires in <strong className="text-white/70">24 hours</strong></p>
                            <p>🔄 Didn&apos;t receive it? Use the form below to resend</p>
                        </div>

                        {/* Resend form */}
                        {!resendSuccess ? (
                            <form onSubmit={handleResend} className="space-y-3">
                                <Input
                                    type="email"
                                    placeholder="your@email.com"
                                    value={resendEmail}
                                    onChange={(e) => setResendEmail(e.target.value)}
                                    leftIcon={<Mail className="h-5 w-5" />}
                                    disabled={isResending}
                                />
                                <Button
                                    type="submit"
                                    variant="outline"
                                    className="w-full"
                                    isLoading={isResending}
                                >
                                    {!isResending && (
                                        <>
                                            <RefreshCw className="h-4 w-4" />
                                            Resend Verification Email
                                        </>
                                    )}
                                </Button>
                            </form>
                        ) : (
                            <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
                                <p className="text-green-400 text-sm">
                                    ✅ Verification email sent! Check your inbox.
                                </p>
                            </div>
                        )}

                        <div className="mt-6">
                            <Link href="/login" className="text-blue-400 hover:text-blue-300 text-sm transition-colors">
                                Already verified? Go to Login →
                            </Link>
                        </div>
                    </>
                )}
            </motion.div>
        </div>
    );
}
