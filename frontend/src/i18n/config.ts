export const locales = ['en', 'bn', 'hi'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';
