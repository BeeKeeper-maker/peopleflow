"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { CheckCircle, XCircle, Loader2, ArrowRight, Mail, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { useTranslations } from "next-intl";

export default function VerifyEmailPage() {
    const searchParams = useSearchParams();
    const token = searchParams.get("token");
    const t = useTranslations("VerifyEmail");
    const { addToast } = useToast();

    const [status, setStatus] = useState<"confirm" | "loading" | "success" | "already-verified" | "error" | "no-token">(
        token ? "confirm" : "no-token"
    );
    const [errorMessage, setErrorMessage] = useState("");
    const [resendEmail, setResendEmail] = useState("");
    const [isResending, setIsResending] = useState(false);
    const [resendSuccess, setResendSuccess] = useState(false);

    useEffect(() => {
        const validateToken = async () => {
            if (!token) return;

            try {
                const res = await fetch(`/api/auth/verify-email?token=${token}`);
                const data = await res.json();

                if (res.ok) {
                    setStatus("confirm");
                } else {
                    setStatus("error");
                    setErrorMessage(data.error || t("errorGeneric"));
                }
            } catch {
                setStatus("error");
                setErrorMessage(t("errorGeneric"));
            }
        };

        validateToken();
    }, [token, t]);

    const handleVerify = async () => {
        if (!token) return;

        setStatus("loading");
        try {
            const res = await fetch("/api/auth/verify-email", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token }),
            });
            const data = await res.json();

            if (res.ok) {
                setStatus(data.alreadyVerified ? "already-verified" : "success");
            } else {
                setStatus("error");
                setErrorMessage(data.error || t("errorGeneric"));
            }
        } catch {
            setStatus("error");
            setErrorMessage(t("errorGeneric"));
        }
    };

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
                    title: t("emailSentTitle"),
                    description: t("emailSentDesc"),
                });
            } else {
                const data = await res.json();
                addToast({
                    type: "error",
                    title: t("errorTitle"),
                    description: data.error || t("errorGeneric"),
                });
            }
        } catch {
            addToast({
                type: "error",
                title: t("errorTitle"),
                description: t("errorResend"),
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
                {/* Explicit confirmation: prevents email scanners/prefetchers from consuming verification tokens */}
                {status === "confirm" && (
                    <>
                        <div className="mx-auto w-16 h-16 rounded-2xl bg-linear-to-br from-blue-500 to-purple-600 flex items-center justify-center mb-4">
                            <Mail className="h-8 w-8 text-white" />
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-2">Verify your email</h2>
                        <p className="text-white/60 mb-6">Please confirm to activate this PeopleFlow account.</p>
                        <Button onClick={handleVerify} className="w-full h-12">
                            Verify Email
                            <ArrowRight className="h-5 w-5" />
                        </Button>
                    </>
                )}

                {/* Loading */}
                {status === "loading" && (
                    <>
                        <Loader2 className="h-12 w-12 text-blue-500 animate-spin mx-auto mb-4" />
                        <h2 className="text-2xl font-bold text-white mb-2">{t("verifying")}</h2>
                        <p className="text-white/60">{t("pleaseWait")}</p>
                    </>
                )}

                {/* Success */}
                {status === "success" && (
                    <>
                        <div className="mx-auto w-16 h-16 rounded-2xl bg-linear-to-br from-green-500 to-emerald-600 flex items-center justify-center mb-4">
                            <CheckCircle className="h-8 w-8 text-white" />
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-2">{t("successTitle")}</h2>
                        <p className="text-white/60 mb-6">
                            {t("successDesc")}
                        </p>
                        <Link href="/login">
                            <Button className="w-full h-12">
                                {t("goToLogin")}
                                <ArrowRight className="h-5 w-5" />
                            </Button>
                        </Link>
                    </>
                )}

                {/* Already verified */}
                {status === "already-verified" && (
                    <>
                        <div className="mx-auto w-16 h-16 rounded-2xl bg-linear-to-br from-blue-500 to-cyan-600 flex items-center justify-center mb-4">
                            <CheckCircle className="h-8 w-8 text-white" />
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-2">{t("alreadyVerifiedTitle")}</h2>
                        <p className="text-white/60 mb-6">
                            {t("alreadyVerifiedDesc")}
                        </p>
                        <Link href="/login">
                            <Button className="w-full h-12">
                                {t("goToLogin")}
                                <ArrowRight className="h-5 w-5" />
                            </Button>
                        </Link>
                    </>
                )}

                {/* Error */}
                {status === "error" && (
                    <>
                        <div className="mx-auto w-16 h-16 rounded-2xl bg-linear-to-br from-red-500 to-red-600 flex items-center justify-center mb-4">
                            <XCircle className="h-8 w-8 text-white" />
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-2">{t("failedTitle")}</h2>
                        <p className="text-white/60 mb-6">{errorMessage}</p>

                        {/* Resend form */}
                        {!resendSuccess ? (
                            <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-left">
                                <p className="text-white/50 text-sm mb-3">
                                    {t("needNewLink")}
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
                                                {t("resendBtn")}
                                            </>
                                        )}
                                    </Button>
                                </form>
                            </div>
                        ) : (
                            <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
                                <p className="text-green-300 text-sm">
                                    {t("resendSuccess")}
                                </p>
                            </div>
                        )}
                    </>
                )}

                {/* No token (landing page after registration) */}
                {status === "no-token" && (
                    <>
                        <div className="mx-auto w-16 h-16 rounded-2xl bg-linear-to-br from-blue-500 to-purple-600 flex items-center justify-center mb-4">
                            <Mail className="h-8 w-8 text-white" />
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-2">{t("checkEmailTitle")}</h2>
                        <p className="text-white/60 mb-6">
                            {t("checkEmailDesc")}
                        </p>

                        <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-white/60 text-sm mb-6 text-left space-y-3">
                            <div className="flex gap-3">
                                <Mail className="h-4 w-4 mt-0.5 text-blue-300 shrink-0" />
                                <p>{t("checkInbox")}</p>
                            </div>
                            <div className="flex gap-3">
                                <CheckCircle className="h-4 w-4 mt-0.5 text-emerald-300 shrink-0" />
                                <p>{t("linkExpires", { duration: "24 hours" })}</p>
                            </div>
                            <div className="flex gap-3">
                                <RefreshCw className="h-4 w-4 mt-0.5 text-purple-300 shrink-0" />
                                <p>{t("didntReceive")}</p>
                            </div>
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
                                            {t("resendEmailBtn")}
                                        </>
                                    )}
                                </Button>
                            </form>
                        ) : (
                            <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
                                <p className="text-green-300 text-sm">
                                    {t("resendSuccess")}
                                </p>
                            </div>
                        )}

                        <div className="mt-6">
                            <Link href="/login" className="text-blue-400 hover:text-blue-300 text-sm transition-colors">
                                {t("alreadyVerified")}
                            </Link>
                        </div>
                    </>
                )}
            </motion.div>
        </div>
    );
}
