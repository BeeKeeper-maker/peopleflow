"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
    Mail,
    Lock,
    Eye,
    EyeOff,
    ArrowRight,
    Building2,
    User,
    ArrowLeft,
    Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { useTranslations } from "next-intl";

type Step = 1 | 2 | 3;

interface FormData {
    // Step 1 - Organization
    organizationName: string;
    industry: string;
    // Step 2 - Admin User
    name: string;
    email: string;
    password: string;
    confirmPassword: string;
    // Step 3 - Confirmation
    agreeToTerms: boolean;
}

type FormErrors = Partial<Record<keyof FormData, string>>;

export default function RegisterPage() {
    const router = useRouter();
    const { addToast } = useToast();
    const t = useTranslations("Auth.register");
    const [step, setStep] = useState<Step>(1);
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [formData, setFormData] = useState<FormData>({
        organizationName: "",
        industry: "",
        name: "",
        email: "",
        password: "",
        confirmPassword: "",
        agreeToTerms: false,
    });
    const [errors, setErrors] = useState<FormErrors>({});

    const industries = [
        { value: "Technology", label: t("industryTechnology") },
        { value: "Healthcare", label: t("industryHealthcare") },
        { value: "Finance & Banking", label: t("industryFinance") },
        { value: "Manufacturing", label: t("industryManufacturing") },
        { value: "Retail", label: t("industryRetail") },
        { value: "Education", label: t("industryEducation") },
        { value: "Consulting", label: t("industryConsulting") },
        { value: "Real Estate", label: t("industryRealEstate") },
        { value: "Hospitality", label: t("industryHospitality") },
        { value: "Other", label: t("industryOther") },
    ];

    const validateStep = () => {
        const newErrors: FormErrors = {};

        if (step === 1) {
            if (!formData.organizationName) {
                newErrors.organizationName = t("orgNameRequired");
            }
            if (!formData.industry) {
                newErrors.industry = t("industrySelectRequired");
            }
        }

        if (step === 2) {
            if (!formData.name) {
                newErrors.name = t("nameRequired");
            }
            if (!formData.email) {
                newErrors.email = t("emailRequired");
            } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
                newErrors.email = t("emailInvalid");
            }
            if (!formData.password) {
                newErrors.password = t("passwordRequired");
            } else if (formData.password.length < 8) {
                newErrors.password = t("passwordMin");
            }
            if (formData.password !== formData.confirmPassword) {
                newErrors.confirmPassword = t("passwordMismatch");
            }
        }

        if (step === 3) {
            if (!formData.agreeToTerms) {
                newErrors.agreeToTerms = t("termsRequired");
            }
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleNext = () => {
        if (validateStep()) {
            setStep((prev) => Math.min(prev + 1, 3) as Step);
        }
    };

    const handleBack = () => {
        setStep((prev) => Math.max(prev - 1, 1) as Step);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateStep()) return;

        setIsLoading(true);

        try {
            const response = await fetch("/api/auth/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    organizationName: formData.organizationName,
                    industry: formData.industry,
                    name: formData.name,
                    email: formData.email,
                    password: formData.password,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || t("toastRegFailed"));
            }

            addToast({
                type: "success",
                title: t("toastAccountCreated"),
                description: t("toastWelcome"),
            });

            setTimeout(() => {
                router.push("/login");
            }, 2000);
        } catch (error) {
            addToast({
                type: "error",
                title: t("toastRegFailed"),
                description: error instanceof Error ? error.message : t("toastRegError"),
            });
        } finally {
            setIsLoading(false);
        }
    };

    const steps = [
        { number: 1, title: t("step1Title") },
        { number: 2, title: t("step2Title") },
        { number: 3, title: t("step3Title") },
    ];

    return (
        <div className="min-h-screen flex">
            {/* Left Panel - Progress */}
            <div className="hidden lg:flex lg:w-2/5 relative overflow-hidden">
                <div className="absolute inset-0 bg-linear-to-br from-purple-600 via-purple-700 to-blue-800">
                    <motion.div
                        className="absolute top-1/3 left-1/3 w-80 h-80 bg-purple-400/30 rounded-full blur-3xl"
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
                </div>

                <div className="relative z-10 flex flex-col justify-center px-16 text-white">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                    >
                        <div className="flex items-center gap-4 mb-12">
                            <div className="flex h-14 w-14 items-center justify-center overflow-hidden">
                                <img src="/logo.png" alt={t("brandName")} className="h-full w-full object-cover rounded-xl" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold">{t("brandName")}</h1>
                                <p className="text-sm text-white/60">{t("brandTagline")}</p>
                            </div>
                        </div>

                        <h2 className="text-3xl font-bold mb-8">
                            {t("createOrgTitle1")}
                            <br />
                            {t("createOrgTitle2")}
                        </h2>

                        {/* Steps */}
                        <div className="space-y-6">
                            {steps.map((s, index) => (
                                <motion.div
                                    key={s.number}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: index * 0.1 }}
                                    className="flex items-center gap-4"
                                >
                                    <div
                                        className={`flex h-10 w-10 items-center justify-center rounded-full transition-all duration-300 ${step >= s.number
                                            ? "bg-white text-purple-600"
                                            : "bg-white/20 text-white/60"
                                            }`}
                                    >
                                        {step > s.number ? (
                                            <Check className="h-5 w-5" />
                                        ) : (
                                            s.number
                                        )}
                                    </div>
                                    <div>
                                        <p
                                            className={`text-sm ${step >= s.number ? "text-white" : "text-white/60"
                                                }`}
                                        >
                                            {t("stepLabel", { number: s.number })}
                                        </p>
                                        <p
                                            className={`font-medium ${step >= s.number ? "text-white" : "text-white/40"
                                                }`}
                                        >
                                            {s.title}
                                        </p>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>
                </div>
            </div>

            {/* Right Panel - Form */}
            <div className="flex-1 flex items-center justify-center p-8 bg-[#0A0A0F]">
                <div className="w-full max-w-md">
                    {/* Mobile Progress */}
                    <div className="lg:hidden flex items-center justify-between mb-8">
                        <div className="flex items-center gap-3">
                            <div className="flex h-12 w-12 items-center justify-center overflow-hidden">
                                <img src="/logo.png" alt={t("brandName")} className="h-full w-full object-cover rounded-xl" />
                            </div>
                            <h1 className="text-xl font-bold text-white">{t("brandName")}</h1>
                        </div>
                        <p className="text-white/60 text-sm">{t("stepOf", { step })}</p>
                    </div>

                    <form onSubmit={step === 3 ? handleSubmit : (e) => e.preventDefault()}>
                        {/* Step 1: Organization */}
                        {step === 1 && (
                            <motion.div
                                key="step1"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-6"
                            >
                                <div className="text-center mb-8">
                                    <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-purple-500/20 text-purple-400 mb-4">
                                        <Building2 className="h-7 w-7" />
                                    </div>
                                    <h2 className="text-2xl font-bold text-white">
                                        {t("orgHeading")}
                                    </h2>
                                    <p className="text-white/60 mt-2">
                                        {t("orgSubheading")}
                                    </p>
                                </div>

                                <Input
                                    label={t("orgNameLabel")}
                                    type="text"
                                    placeholder={t("orgNamePlaceholder")}
                                    value={formData.organizationName}
                                    onChange={(e) =>
                                        setFormData({ ...formData, organizationName: e.target.value })
                                    }
                                    error={errors.organizationName}
                                    leftIcon={<Building2 className="h-5 w-5" />}
                                />

                                <div>
                                    <label className="block text-sm font-medium text-white/80 mb-2">
                                        {t("industryLabel")} <span className="text-red-400">*</span>
                                    </label>
                                    <select
                                        value={formData.industry}
                                        onChange={(e) =>
                                            setFormData({ ...formData, industry: e.target.value })
                                        }
                                        className="w-full h-11 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                                    >
                                        <option value="" className="bg-[#141419]">
                                            {t("selectIndustry")}
                                        </option>
                                        {industries.map((ind) => (
                                            <option key={ind.value} value={ind.value} className="bg-[#141419]">
                                                {ind.label}
                                            </option>
                                        ))}
                                    </select>
                                    {errors.industry && (
                                        <p className="mt-1.5 text-xs text-red-400">
                                            {errors.industry}
                                        </p>
                                    )}
                                </div>

                                <Button
                                    type="button"
                                    onClick={handleNext}
                                    className="w-full h-12"
                                >
                                    {t("continue")}
                                    <ArrowRight className="h-5 w-5" />
                                </Button>
                            </motion.div>
                        )}

                        {/* Step 2: Admin Account */}
                        {step === 2 && (
                            <motion.div
                                key="step2"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-5"
                            >
                                <div className="text-center mb-8">
                                    <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-blue-500/20 text-blue-400 mb-4">
                                        <User className="h-7 w-7" />
                                    </div>
                                    <h2 className="text-2xl font-bold text-white">
                                        {t("adminHeading")}
                                    </h2>
                                    <p className="text-white/60 mt-2">
                                        {t("adminSubheading")}
                                    </p>
                                </div>

                                <Input
                                    label={t("fullNameLabel")}
                                    type="text"
                                    placeholder={t("fullNamePlaceholder")}
                                    value={formData.name}
                                    onChange={(e) =>
                                        setFormData({ ...formData, name: e.target.value })
                                    }
                                    error={errors.name}
                                    leftIcon={<User className="h-5 w-5" />}
                                />

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
                                />

                                <Input
                                    label={t("passwordLabel")}
                                    type={showPassword ? "text" : "password"}
                                    placeholder={t("passwordPlaceholder")}
                                    value={formData.password}
                                    onChange={(e) =>
                                        setFormData({ ...formData, password: e.target.value })
                                    }
                                    error={errors.password}
                                    hint={t("passwordHint")}
                                    leftIcon={<Lock className="h-5 w-5" />}
                                    rightIcon={
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                        >
                                            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                        </button>
                                    }
                                />

                                <Input
                                    label={t("confirmPasswordLabel")}
                                    type={showPassword ? "text" : "password"}
                                    placeholder={t("confirmPasswordPlaceholder")}
                                    value={formData.confirmPassword}
                                    onChange={(e) =>
                                        setFormData({ ...formData, confirmPassword: e.target.value })
                                    }
                                    error={errors.confirmPassword}
                                    leftIcon={<Lock className="h-5 w-5" />}
                                />

                                <div className="flex gap-3 pt-2">
                                    <Button
                                        type="button"
                                        onClick={handleBack}
                                        variant="outline"
                                        className="flex-1 h-12"
                                    >
                                        <ArrowLeft className="h-5 w-5" />
                                        {t("back")}
                                    </Button>
                                    <Button
                                        type="button"
                                        onClick={handleNext}
                                        className="flex-1 h-12"
                                    >
                                        {t("continue")}
                                        <ArrowRight className="h-5 w-5" />
                                    </Button>
                                </div>
                            </motion.div>
                        )}

                        {/* Step 3: Confirmation */}
                        {step === 3 && (
                            <motion.div
                                key="step3"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-6"
                            >
                                <div className="text-center mb-8">
                                    <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-emerald-500/20 text-emerald-400 mb-4">
                                        <Check className="h-7 w-7" />
                                    </div>
                                    <h2 className="text-2xl font-bold text-white">
                                        {t("reviewHeading")}
                                    </h2>
                                    <p className="text-white/60 mt-2">
                                        {t("reviewSubheading")}
                                    </p>
                                </div>

                                <div className="space-y-4">
                                    <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                                        <p className="text-xs text-white/40 mb-1">{t("reviewOrgLabel")}</p>
                                        <p className="text-white font-medium">
                                            {formData.organizationName}
                                        </p>
                                        <p className="text-white/60 text-sm">{formData.industry}</p>
                                    </div>

                                    <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                                        <p className="text-xs text-white/40 mb-1">{t("reviewAdminLabel")}</p>
                                        <p className="text-white font-medium">{formData.name}</p>
                                        <p className="text-white/60 text-sm">{formData.email}</p>
                                    </div>
                                </div>

                                <label className="flex items-start gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={formData.agreeToTerms}
                                        onChange={(e) =>
                                            setFormData({ ...formData, agreeToTerms: e.target.checked })
                                        }
                                        className="h-5 w-5 mt-0.5 rounded border-white/20 bg-white/5 text-blue-500 focus:ring-blue-500/50"
                                    />
                                    <span className="text-sm text-white/60">
                                        {t("agreeToTerms")}{" "}
                                        <Link href="/terms" className="text-blue-400">
                                            {t("termsOfService")}
                                        </Link>{" "}
                                        {t("and")}{" "}
                                        <Link href="/privacy" className="text-blue-400">
                                            {t("privacyPolicy")}
                                        </Link>
                                    </span>
                                </label>

                                <div className="flex gap-3 pt-2">
                                    <Button
                                        type="button"
                                        onClick={handleBack}
                                        variant="outline"
                                        className="flex-1 h-12"
                                        disabled={isLoading}
                                    >
                                        <ArrowLeft className="h-5 w-5" />
                                        {t("back")}
                                    </Button>
                                    <Button
                                        type="submit"
                                        className="flex-1 h-12"
                                        isLoading={isLoading}
                                    >
                                        {!isLoading && t("createAccount")}
                                    </Button>
                                </div>
                            </motion.div>
                        )}
                    </form>

                    <div className="mt-8 text-center">
                        <p className="text-white/40 text-sm">
                            {t("alreadyHaveAccount")}{" "}
                            <Link
                                href="/login"
                                className="text-blue-400 hover:text-blue-300 transition-colors"
                            >
                                {t("signIn")}
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
