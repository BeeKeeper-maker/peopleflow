import { getTranslations } from "next-intl/server";
import LoginClient, { type LoginCopy } from "./login-client";

export default async function LoginPage() {
    const t = await getTranslations("Auth.login");

    const copy: LoginCopy = {
        brandName: t("brandName"),
        brandTagline: t("brandTagline"),
        heroTitle1: t("heroTitle1"),
        heroTitle2: t("heroTitle2"),
        heroDescription: t("heroDescription"),
        welcomeBack: t("welcomeBack"),
        signInSubtitle: t("signInSubtitle"),
        emailLabel: t("emailLabel"),
        emailPlaceholder: t("emailPlaceholder"),
        passwordLabel: t("passwordLabel"),
        passwordPlaceholder: t("passwordPlaceholder"),
        rememberMe: t("rememberMe"),
        forgotPassword: t("forgotPassword"),
        signIn: t("signIn"),
        noAccount: t("noAccount"),
        createOrg: t("createOrg"),
        demoCredentials: t("demoCredentials"),
        demoEmail: t("demoEmail"),
        demoPassword: t("demoPassword"),
        toastLoginFailed: t("toastLoginFailed"),
        toastLoginSuccess: t("toastLoginSuccess"),
        toastError: t("toastError"),
        toastUnexpectedError: t("toastUnexpectedError"),
        toastWelcomeBack: t("toastWelcomeBack"),
        emailRequired: t("emailRequired"),
        emailInvalid: t("emailInvalid"),
        passwordRequired: t("passwordRequired"),
        feature1: t("feature1"),
        feature2: t("feature2"),
        feature3: t("feature3"),
        feature4: t("feature4"),
    };

    return <LoginClient copy={copy} />;
}
