/**
 * Bengali i18n Utility Functions
 * 
 * Provides Bengali number conversion, date formatting, and other
 * locale-specific utilities used across the application.
 */

// ─── Bengali Number Conversion ──────────────────────────────────────────────────

const bnDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

export function toBengaliNumber(num: number | string): string {
    return String(num).replace(/\d/g, (d) => bnDigits[parseInt(d)] || d);
}

// ─── Bengali Date Formatting ────────────────────────────────────────────────────

const bnMonths = [
    'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
    'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'
];

const bnDays = [
    'রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার'
];

export function toBengaliDate(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return String(date);
    return `${toBengaliNumber(d.getDate())} ${bnMonths[d.getMonth()]} ${toBengaliNumber(d.getFullYear())}`;
}

export function toBengaliDateTime(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return String(date);
    const hours = d.getHours();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const h12 = hours % 12 || 12;
    const mins = d.getMinutes().toString().padStart(2, '0');
    return `${toBengaliDate(d)} ${toBengaliNumber(h12)}:${toBengaliNumber(mins)} ${ampm}`;
}

export function getBengaliDayName(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return bnDays[d.getDay()];
}

// ─── Locale-aware Formatting ────────────────────────────────────────────────────

/**
 * Format a number based on locale: Bengali digits for 'bn', standard for 'en'
 */
export function formatNumber(num: number | string, locale: string): string {
    return locale === 'bn' ? toBengaliNumber(num) : String(num);
}

/**
 * Format a date based on locale
 */
export function formatDate(date: Date | string, locale: string): string {
    return locale === 'bn' ? toBengaliDate(date) : new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
}
