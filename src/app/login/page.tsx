"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Mail, Lock, Eye, EyeOff, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { useTranslations } from "next-intl";

export default function LoginPage() {
    const router = useRouter();
    const { addToast } = useToast();
    const t = useTranslations("Auth.login");
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [formData, setFormData] = useState({
        email: "",
        password: "",
    });
    const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

    const validateForm = () => {
        const newErrors: { email?: string; password?: string } = {};

        if (!formData.email) {
            newErrors.email = t("emailRequired");
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            newErrors.email = t("emailInvalid");
        }

        if (!formData.password) {
            newErrors.password = t("passwordRequired");
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateForm()) return;

        setIsLoading(true);

        try {
            const result = await signIn("credentials", {
                email: formData.email,
                password: formData.password,
                redirect: false,
            });

            if (result?.error) {
                addToast({
                    type: "error",
                    title: t("toastLoginFailed"),
                    description: result.error,
                });
            } else {
                addToast({
                    type: "success",
                    title: t("toastWelcomeBack"),
                    description: t("toastLoginSuccess"),
                });
                router.push("/dashboard");
                router.refresh();
            }
        } catch (error) {
            addToast({
                type: "error",
                title: t("toastError"),
                description: t("toastUnexpectedError"),
            });
        } finally {
            setIsLoading(false);
        }
    };

    const features = [
        t("feature1"),
        t("feature2"),
        t("feature3"),
        t("feature4"),
    ];

    return (
        <div className="min-h-screen flex">
            {/* Left Panel - Branding */}
            <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
                {/* Animated Background */}
                <div className="absolute inset-0 bg-linear-to-br from-blue-600 via-blue-700 to-purple-800">
                    <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-20" />
                    <motion.div
                        className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-400/30 rounded-full blur-3xl"
                        animate={{
                            scale: [1, 1.2, 1],
                            opacity: [0.3, 0.5, 0.3],
                        }}
                        transition={{
                            duration: 8,
                            repeat: Infinity,
                            ease: "easeInOut",
                        }}
                    />
                    <motion.div
                        className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-purple-400/30 rounded-full blur-3xl"
                        animate={{
                            scale: [1.2, 1, 1.2],
                            opacity: [0.5, 0.3, 0.5],
                        }}
                        transition={{
                            duration: 8,
                            repeat: Infinity,
                            ease: "easeInOut",
                        }}
                    />
                </div>

                {/* Content */}
                <div className="relative z-10 flex flex-col justify-center px-16 text-white">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                    >
                        <div className="flex items-center gap-4 mb-8">
                            <div className="flex h-14 w-14 items-center justify-center overflow-hidden">
                                <img src="/logo.png" alt={t("brandName")} className="h-full w-full object-cover rounded-xl" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold">{t("brandName")}</h1>
                                <p className="text-sm text-white/60">{t("brandTagline")}</p>
                            </div>
                        </div>

                        <h2 className="text-4xl font-bold leading-tight mb-6">
                            {t("heroTitle1")}
                            <br />
                            <span className="text-transparent bg-clip-text bg-linear-to-r from-blue-200 to-purple-200">
                                {t("heroTitle2")}
                            </span>
                        </h2>

                        <p className="text-lg text-white/80 mb-12 max-w-md">
                            {t("heroDescription")}
                        </p>

                        <div className="space-y-4">
                            {features.map((feature, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ duration: 0.5, delay: 0.2 + i * 0.1 }}
                                    className="flex items-center gap-2 text-white/90"
                                >
                                    {feature}
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>
                </div>
            </div>

            {/* Right Panel - Login Form */}
            <div className="flex-1 flex items-center justify-center p-8 bg-[#0A0A0F]">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="w-full max-w-md"
                >
                    {/* Mobile Logo */}
                    <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
                        <div className="flex h-12 w-12 items-center justify-center overflow-hidden">
                            <img src="/logo.png" alt={t("brandName")} className="h-full w-full object-cover rounded-xl" />
                        </div>
                        <h1 className="text-xl font-bold text-white">{t("brandName")}</h1>
                    </div>

                    <div className="text-center mb-8">
                        <h2 className="text-2xl font-bold text-white mb-2">{t("welcomeBack")}</h2>
                        <p className="text-white/60">
                            {t("signInSubtitle")}
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <Input
                            label={t("emailLabel")}
                            type="email"
                            placeholder={t("emailPlaceholder")}
                            value={formData.email}
                            onChange={(e) =>
                                setFormData({ ...formData, email: e.target.value })
                            }
                            error={errors.email}
                            leftIcon={<Mail className="h-5 w-5" />}
                            autoComplete="email"
                            disabled={isLoading}
                        />

                        <div className="relative">
                            <Input
                                label={t("passwordLabel")}
                                type={showPassword ? "text" : "password"}
                                placeholder={t("passwordPlaceholder")}
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
                                        className="hover:text-white/60 transition-colors"
                                    >
                                        {showPassword ? (
                                            <EyeOff className="h-5 w-5" />
                                        ) : (
                                            <Eye className="h-5 w-5" />
                                        )}
                                    </button>
                                }
                                autoComplete="current-password"
                                disabled={isLoading}
                            />
                        </div>

                        <div className="flex items-center justify-between text-sm">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="h-4 w-4 rounded border-white/20 bg-white/5 text-blue-500 focus:ring-blue-500/50"
                                />
                                <span className="text-white/60">{t("rememberMe")}</span>
                            </label>
                            <span
                                className="text-white/40 cursor-default"
                                title={t("forgotPasswordTooltip")}
                            >
                                {t("forgotPassword")}
                            </span>
                        </div>

                        <Button
                            type="submit"
                            className="w-full h-12"
                            isLoading={isLoading}
                        >
                            {!isLoading && (
                                <>
                                    {t("signIn")}
                                    <ArrowRight className="h-5 w-5" />
                                </>
                            )}
                        </Button>
                    </form>

                    <div className="mt-8">
                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-white/10" />
                            </div>
                            <div className="relative flex justify-center text-sm">
                                <span className="px-4 bg-[#0A0A0F] text-white/40">
                                    {t("noAccount")}
                                </span>
                            </div>
                        </div>

                        <div className="mt-6 text-center">
                            <Link
                                href="/register"
                                className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors font-medium"
                            >
                                {t("createOrg")}
                                <ArrowRight className="h-4 w-4" />
                            </Link>
                        </div>
                    </div>

                    {/* Demo Credentials - only visible in development */}
                    {process.env.NODE_ENV === "development" && (
                        <div className="mt-8 p-4 rounded-xl bg-white/5 border border-white/10">
                            <p className="text-xs text-white/40 mb-2">{t("demoCredentials")}</p>
                            <div className="space-y-1 text-sm text-white/60">
                                <p><span className="text-white/40">{t("demoEmail")}</span> admin@demo.com</p>
                                <p><span className="text-white/40">{t("demoPassword")}</span> Demo@123</p>
                            </div>
                        </div>
                    )}
                </motion.div>
            </div>
        </div>
    );
}
