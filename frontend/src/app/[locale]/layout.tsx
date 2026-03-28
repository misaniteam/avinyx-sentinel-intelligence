import { Inter, Noto_Sans_Bengali, Noto_Sans_Devanagari } from "next/font/google";
import { getMessages, setRequestLocale } from "next-intl/server";
import "./globals.css";
import { Providers } from "@/components/providers";
import { hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const notoSansBengali = Noto_Sans_Bengali({
  subsets: ["bengali"],
  variable: "--font-noto-bengali",
  display: "swap",
});
const notoSansDevanagari = Noto_Sans_Devanagari({
  subsets: ["devanagari"],
  variable: "--font-noto-devanagari",
  display: "swap",
});

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export const metadata: Metadata = {
  title: "Avinyx Intelligence",
  description: "Political campaign sentiment intelligence platform",
};



export default async function RootLayout({ children, params }: Props) {
const {locale} = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

    // Enable static rendering
  setRequestLocale(locale);

  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className={`${inter.variable} ${notoSansBengali.variable} ${notoSansDevanagari.variable} font-sans`}>
        <Providers locale={locale} messages={messages}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
