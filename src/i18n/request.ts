import { getRequestConfig } from 'next-intl/server';
import { IntlErrorCode } from 'next-intl';

export default getRequestConfig(async () => {
    // Read locale from cookie, default to 'en'
    // CRITICAL: During prerendering of special pages like _global-error,
    // there is no request context, so cookies() will throw.
    // We must handle this gracefully with a fallback.
    let locale = 'en';
    
    try {
        const { cookies } = await import('next/headers');
        const cookieStore = await cookies();
        const cookieLocale = cookieStore.get('peopleflow-locale')?.value;
        if (cookieLocale === 'bn') {
            locale = 'bn';
        }
    } catch {
        // No request context (prerendering _global-error, etc.) — use default locale
    }

    return {
        locale,
        messages: (await import(`../../messages/${locale}.json`)).default,

        // ── Enterprise-grade i18n error handler ─────────────────────
        // Silences MISSING_MESSAGE warnings for dynamic route segments
        // (CUIDs, UUIDs, numeric IDs) that should never be translated.
        // Genuine missing translations are still logged as warnings.
        onError(error) {
            if (error.code === IntlErrorCode.MISSING_MESSAGE) {
                // Extract the key from the error message
                const msg = error.message || '';
                // Check if the missing key looks like a dynamic ID
                const isDynamicId = /\bc[a-z0-9]{20,}\b/i.test(msg) ||  // CUID
                    /\b[0-9a-f]{8}-[0-9a-f]{4}-/i.test(msg) ||           // UUID
                    /\.(\d+)['"]?\s*$/.test(msg);                         // Numeric ID
                if (isDynamicId) return; // Silently skip — not a real missing translation
            }
            // Log all other errors (genuine missing keys, format errors, etc.)
            console.warn(error.message);
        },
        getMessageFallback({ namespace, key }) {
            // For missing keys, return a humanized fallback instead of the raw key path
            const lastKey = key.split('.').pop() || key;
            return lastKey.charAt(0).toUpperCase() + lastKey.slice(1).replace(/-/g, ' ');
        },
    };
});
