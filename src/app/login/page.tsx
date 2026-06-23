"use client";

import { useState } from "react";
import { getSession, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mail, Lock, Eye, EyeOff, ArrowRight, KeyRound } from "lucide-react";
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
    const [needsTwoFactor, setNeedsTwoFactor] = useState(false);
    const [formData, setFormData] = useState({
        email: "",
        password: "",
        twoFactorCode: "",
    });
    const [errors, setErrors] = useState<{ email?: string; password?: string; twoFactorCode?: string }>({});

    const validateForm = () => {
        const newErrors: { email?: string; password?: string; twoFactorCode?: string } = {};

        if (!formData.email) {
            newErrors.email = t("emailRequired");
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            newErrors.email = t("emailInvalid");
        }

        if (!formData.password) {
            newErrors.password = t("passwordRequired");
        }

        if (needsTwoFactor && !formData.twoFactorCode.trim()) {
            newErrors.twoFactorCode = "Enter your 6-digit authenticator code.";
        } else if (needsTwoFactor && !/^\d{6}$/.test(formData.twoFactorCode.replace(/\s+/g, ""))) {
            newErrors.twoFactorCode = "Authenticator code must be 6 digits.";
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
                twoFactorCode: needsTwoFactor ? formData.twoFactorCode : "",
                redirect: false,
            });

            if (result?.error) {
                const requiresTwoFactor = result.error.toLowerCase().includes("two-factor") || result.error.toLowerCase().includes("two factor");
                if (requiresTwoFactor) {
                    setNeedsTwoFactor(true);
                    setErrors((prev) => ({ ...prev, twoFactorCode: "Enter your authenticator code to continue." }));
                }
                addToast({
                    type: requiresTwoFactor ? "info" : "error",
                    title: requiresTwoFactor ? "Two-factor verification required" : t("toastLoginFailed"),
                    description: requiresTwoFactor ? "Your account has 2FA enabled. Enter the 6-digit code from your authenticator app." : result.error,
                });
            } else {
                addToast({
                    type: "success",
                    title: t("toastWelcomeBack"),
                    description: t("toastLoginSuccess"),
                });
                const session = await getSession();
                const role = session?.user?.role;
                const defaultRoute = role === "employee"
                    ? "/ess/dashboard"
                    : role === "manager"
                        ? "/manager/dashboard"
                        : "/dashboard";
                router.push(defaultRoute);
                router.refresh();
            }
        } catch {
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
                    <div
                        className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-400/30 rounded-full blur-3xl"
                    />
                    <div
                        className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-purple-400/30 rounded-full blur-3xl"
                    />
                </div>

                {/* Content */}
                <div className="relative z-10 flex flex-col justify-center px-16 text-white">
                    <div
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
                                <div
                                    key={i}
                                    className="flex items-center gap-2 text-white/90"
                                >
                                    {feature}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Panel - Login Form */}
            <div className="flex-1 flex items-center justify-center p-8 bg-[#0A0A0F]">
                <div
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
                            onChange={(e) => {
                                setFormData({ ...formData, email: e.target.value, twoFactorCode: "" })
                                setNeedsTwoFactor(false)
                            }}
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

                        {needsTwoFactor && (
                            <div className="rounded-xl border border-blue-500/25 bg-blue-500/5 p-4 space-y-3">
                                <div className="flex items-start gap-3">
                                    <KeyRound className="h-5 w-5 text-blue-400 mt-0.5" />
                                    <div>
                                        <p className="text-sm font-medium text-white">Two-factor authentication</p>
                                        <p className="text-xs text-white/50 mt-1">This account has 2FA enabled. Enter the current 6-digit code from your authenticator app.</p>
                                    </div>
                                </div>
                                <Input
                                    label="Authenticator code"
                                    name="twoFactorCode"
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={6}
                                    placeholder="123456"
                                    value={formData.twoFactorCode}
                                    onChange={(e) =>
                                        setFormData({ ...formData, twoFactorCode: e.target.value.replace(/\D/g, "").slice(0, 6) })
                                    }
                                    error={errors.twoFactorCode}
                                    leftIcon={<KeyRound className="h-5 w-5" />}
                                    autoComplete="one-time-code"
                                    disabled={isLoading}
                                />
                            </div>
                        )}

                        <div className="flex items-center justify-between text-sm">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="h-4 w-4 rounded border-white/20 bg-white/5 text-blue-500 focus:ring-blue-500/50"
                                />
                                <span className="text-white/60">{t("rememberMe")}</span>
                            </label>
                            <Link
                                href="/forgot-password"
                                className="text-blue-400 hover:text-blue-300 transition-colors"
                            >
                                {t("forgotPassword")}
                            </Link>
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
                                <p><span className="text-white/40">{t("demoPassword")}</span> Admin@123</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
