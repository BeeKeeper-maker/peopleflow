import { getRequestConfig } from 'next-intl/server';

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
        messages: (await import(`../../messages/${locale}.json`)).default
    };
});
