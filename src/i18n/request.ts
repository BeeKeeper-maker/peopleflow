import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';

export default getRequestConfig(async () => {
    // Read locale from cookie, default to 'en'
    const cookieStore = await cookies();
    const locale = cookieStore.get('peopleflow-locale')?.value || 'en';
    const validLocale = locale === 'bn' ? 'bn' : 'en';

    return {
        locale: validLocale,
        messages: (await import(`../../messages/${validLocale}.json`)).default
    };
});
