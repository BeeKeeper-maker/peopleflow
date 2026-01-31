/**
 * Password Policy Configuration
 * Enforces strong password requirements
 */

export interface PasswordValidationResult {
    isValid: boolean;
    errors: string[];
    strength: "weak" | "fair" | "good" | "strong";
    score: number;
}

export interface PasswordPolicy {
    minLength: number;
    maxLength: number;
    requireUppercase: boolean;
    requireLowercase: boolean;
    requireNumbers: boolean;
    requireSpecialChars: boolean;
    disallowCommonPasswords: boolean;
    disallowUserInfo: boolean;
}

// Default password policy
export const DEFAULT_PASSWORD_POLICY: PasswordPolicy = {
    minLength: 8,
    maxLength: 128,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    disallowCommonPasswords: true,
    disallowUserInfo: true,
};

// Common weak passwords to block
const COMMON_PASSWORDS = new Set([
    "password", "123456", "12345678", "qwerty", "abc123",
    "monkey", "1234567", "letmein", "trustno1", "dragon",
    "baseball", "iloveyou", "master", "sunshine", "ashley",
    "bailey", "shadow", "123123", "654321", "superman",
    "qazwsx", "michael", "football", "password1", "password123",
    "welcome", "welcome1", "admin", "admin123", "root",
]);

/**
 * Validate password against policy
 */
export function validatePassword(
    password: string,
    policy: PasswordPolicy = DEFAULT_PASSWORD_POLICY,
    userInfo?: { email?: string; name?: string }
): PasswordValidationResult {
    const errors: string[] = [];
    let score = 0;

    // Length checks
    if (password.length < policy.minLength) {
        errors.push(`Password must be at least ${policy.minLength} characters`);
    } else {
        score += 1;
        if (password.length >= 12) score += 1;
        if (password.length >= 16) score += 1;
    }

    if (password.length > policy.maxLength) {
        errors.push(`Password must not exceed ${policy.maxLength} characters`);
    }

    // Character requirements
    if (policy.requireUppercase && !/[A-Z]/.test(password)) {
        errors.push("Password must contain at least one uppercase letter");
    } else if (policy.requireUppercase) {
        score += 1;
    }

    if (policy.requireLowercase && !/[a-z]/.test(password)) {
        errors.push("Password must contain at least one lowercase letter");
    } else if (policy.requireLowercase) {
        score += 1;
    }

    if (policy.requireNumbers && !/\d/.test(password)) {
        errors.push("Password must contain at least one number");
    } else if (policy.requireNumbers) {
        score += 1;
    }

    if (policy.requireSpecialChars && !/[!@#$%^&*()_+\-=\[\]{};':\"\\|,.<>\/?]/.test(password)) {
        errors.push("Password must contain at least one special character (!@#$%^&*...)");
    } else if (policy.requireSpecialChars) {
        score += 1;
    }

    // Common password check
    if (policy.disallowCommonPasswords) {
        const lowerPassword = password.toLowerCase();
        if (COMMON_PASSWORDS.has(lowerPassword)) {
            errors.push("This password is too common. Please choose a stronger password");
            score = Math.max(0, score - 2);
        }
    }

    // User info check (prevent using email/name in password)
    if (policy.disallowUserInfo && userInfo) {
        const lowerPassword = password.toLowerCase();

        if (userInfo.email) {
            const emailParts = userInfo.email.toLowerCase().split("@");
            if (emailParts[0] && lowerPassword.includes(emailParts[0])) {
                errors.push("Password should not contain your email address");
                score = Math.max(0, score - 1);
            }
        }

        if (userInfo.name) {
            const nameParts = userInfo.name.toLowerCase().split(/\s+/);
            for (const part of nameParts) {
                if (part.length >= 3 && lowerPassword.includes(part)) {
                    errors.push("Password should not contain your name");
                    score = Math.max(0, score - 1);
                    break;
                }
            }
        }
    }

    // Additional scoring for variety
    const uniqueChars = new Set(password).size;
    if (uniqueChars >= 8) score += 1;
    if (uniqueChars >= 12) score += 1;

    // Determine strength
    let strength: "weak" | "fair" | "good" | "strong";
    if (score <= 2) strength = "weak";
    else if (score <= 4) strength = "fair";
    else if (score <= 6) strength = "good";
    else strength = "strong";

    return {
        isValid: errors.length === 0,
        errors,
        strength,
        score: Math.min(10, score),
    };
}

/**
 * Generate a secure random password
 */
export function generateSecurePassword(length: number = 16): string {
    const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const lowercase = "abcdefghijklmnopqrstuvwxyz";
    const numbers = "0123456789";
    const special = "!@#$%^&*()_+-=[]{}|;:,.<>?";
    const allChars = uppercase + lowercase + numbers + special;

    let password = "";

    // Ensure at least one of each required type
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += special[Math.floor(Math.random() * special.length)];

    // Fill the rest randomly
    for (let i = 4; i < length; i++) {
        password += allChars[Math.floor(Math.random() * allChars.length)];
    }

    // Shuffle the password
    return password.split("").sort(() => Math.random() - 0.5).join("");
}

/**
 * Check if password was recently used (for password history)
 */
export async function checkPasswordHistory(
    newPasswordHash: string,
    previousHashes: string[],
    historyCount: number = 5
): Promise<boolean> {
    const recentHashes = previousHashes.slice(-historyCount);
    return !recentHashes.includes(newPasswordHash);
}

/**
 * Get password strength indicator color
 */
export function getStrengthColor(strength: PasswordValidationResult["strength"]): string {
    switch (strength) {
        case "weak": return "red";
        case "fair": return "orange";
        case "good": return "yellow";
        case "strong": return "green";
    }
}
