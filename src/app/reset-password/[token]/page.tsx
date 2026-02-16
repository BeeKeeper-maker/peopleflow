"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Lock, Eye, EyeOff, ArrowLeft, ArrowRight, CheckCircle, XCircle, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";

export default function ResetPasswordPage() {
    const router = useRouter();
    const params = useParams();
    const token = params.token as string;
    const { addToast } = useToast();

    const [isLoading, setIsLoading] = useState(false);
    const [isValidating, setIsValidating] = useState(true);
    const [isValid, setIsValid] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [formData, setFormData] = useState({
        password: "",
        confirmPassword: "",
    });
    const [errors, setErrors] = useState<{ password?: string; confirmPassword?: string }>({});

    // Validate token on mount
    useEffect(() => {
        const validateToken = async () => {
            try {
                const res = await fetch(`/api/auth/reset-password?token=${token}`);
                const data = await res.json();
                setIsValid(data.valid === true);
            } catch {
                setIsValid(false);
            } finally {
                setIsValidating(false);
            }
        };

        if (token) {
            validateToken();
        } else {
            setIsValidating(false);
            setIsValid(false);
        }
    }, [token]);

    const validateForm = () => {
        const newErrors: { password?: string; confirmPassword?: string } = {};

        if (!formData.password) {
            newErrors.password = "Password is required";
        } else if (formData.password.length < 8) {
            newErrors.password = "Password must be at least 8 characters";
        } else if (!/[A-Z]/.test(formData.password)) {
            newErrors.password = "Must contain at least one uppercase letter";
        } else if (!/[a-z]/.test(formData.password)) {
            newErrors.password = "Must contain at least one lowercase letter";
        } else if (!/[0-9]/.test(formData.password)) {
            newErrors.password = "Must contain at least one number";
        }

        if (!formData.confirmPassword) {
            newErrors.confirmPassword = "Please confirm your password";
        } else if (formData.password !== formData.confirmPassword) {
            newErrors.confirmPassword = "Passwords do not match";
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateForm()) return;

        setIsLoading(true);

        try {
            const res = await fetch("/api/auth/reset-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    token,
                    password: formData.password,
                    confirmPassword: formData.confirmPassword,
                }),
            });

            const data = await res.json();

            if (res.ok) {
                setIsSuccess(true);
            } else {
                addToast({
                    type: "error",
                    title: "Reset Failed",
                    description: data.error || "Something went wrong",
                });
            }
        } catch {
            addToast({
                type: "error",
                title: "Error",
                description: "Failed to reset password. Please try again.",
            });
        } finally {
            setIsLoading(false);
        }
    };

    // Loading state
    if (isValidating) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#0A0A0F]">
                <div className="text-center">
                    <Loader2 className="h-8 w-8 text-blue-500 animate-spin mx-auto mb-4" />
                    <p className="text-white/60">Validating reset link...</p>
                </div>
            </div>
        );
    }

    // Invalid/expired token
    if (!isValid && !isSuccess) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#0A0A0F] p-4">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="w-full max-w-md text-center"
                >
                    <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center mb-4">
                        <XCircle className="h-8 w-8 text-white" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">
                        Invalid or Expired Link
                    </h2>
                    <p className="text-white/60 mb-6">
                        This password reset link is invalid or has expired.
                        Please request a new one.
                    </p>
                    <Link href="/forgot-password">
                        <Button className="w-full">
                            Request New Reset Link
                            <ArrowRight className="h-5 w-5" />
                        </Button>
                    </Link>
                </motion.div>
            </div>
        );
    }

    // Success state
    if (isSuccess) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#0A0A0F] p-4">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="w-full max-w-md text-center"
                >
                    <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center mb-4">
                        <CheckCircle className="h-8 w-8 text-white" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">
                        Password Reset Successfully!
                    </h2>
                    <p className="text-white/60 mb-6">
                        Your password has been changed. You can now log in with your new password.
                    </p>
                    <Link href="/login">
                        <Button className="w-full h-12">
                            Go to Login
                            <ArrowRight className="h-5 w-5" />
                        </Button>
                    </Link>
                </motion.div>
            </div>
        );
    }

    // Reset form
    return (
        <div className="min-h-screen flex items-center justify-center bg-[#0A0A0F] p-4">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="w-full max-w-md"
            >
                <Link
                    href="/login"
                    className="inline-flex items-center gap-2 text-white/40 hover:text-white/60 transition-colors mb-8"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Login
                </Link>

                <div className="text-center mb-8">
                    <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mb-4">
                        <ShieldCheck className="h-8 w-8 text-white" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">
                        Set New Password
                    </h2>
                    <p className="text-white/60">
                        Choose a strong password that you haven&apos;t used before.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    <Input
                        label="New Password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter new password"
                        value={formData.password}
                        onChange={(e) =>
                            setFormData({ ...formData, password: e.target.value })
                        }
                        error={errors.password}
                        leftIcon={<Lock className="h-5 w-5" />}
                        rightIcon={
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                            >
                                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                            </button>
                        }
                        autoComplete="new-password"
                        disabled={isLoading}
                    />

                    <Input
                        label="Confirm New Password"
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="Confirm new password"
                        value={formData.confirmPassword}
                        onChange={(e) =>
                            setFormData({ ...formData, confirmPassword: e.target.value })
                        }
                        error={errors.confirmPassword}
                        leftIcon={<Lock className="h-5 w-5" />}
                        rightIcon={
                            <button
                                type="button"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            >
                                {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                            </button>
                        }
                        autoComplete="new-password"
                        disabled={isLoading}
                    />

                    {/* Password requirements */}
                    <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                        <p className="text-white/40 text-xs font-medium mb-2">Password requirements:</p>
                        <div className="grid grid-cols-2 gap-1 text-xs">
                            <RequirementCheck met={formData.password.length >= 8} text="8+ characters" />
                            <RequirementCheck met={/[A-Z]/.test(formData.password)} text="Uppercase letter" />
                            <RequirementCheck met={/[a-z]/.test(formData.password)} text="Lowercase letter" />
                            <RequirementCheck met={/[0-9]/.test(formData.password)} text="Number" />
                        </div>
                    </div>

                    <Button
                        type="submit"
                        className="w-full h-12"
                        isLoading={isLoading}
                    >
                        {!isLoading && (
                            <>
                                Reset Password
                                <ArrowRight className="h-5 w-5" />
                            </>
                        )}
                    </Button>
                </form>
            </motion.div>
        </div>
    );
}

function RequirementCheck({ met, text }: { met: boolean; text: string }) {
    return (
        <div className={`flex items-center gap-1.5 ${met ? "text-green-400" : "text-white/30"}`}>
            {met ? (
                <CheckCircle className="h-3.5 w-3.5" />
            ) : (
                <div className="h-3.5 w-3.5 rounded-full border border-current" />
            )}
            <span>{text}</span>
        </div>
    );
}
