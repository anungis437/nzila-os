import { NextIntlClientProvider } from "next-intl";
import { notFound } from "next/navigation";
import { locales } from "@/lib/locales";
import enMessages from "../../messages/en-CA.json";
import frMessages from "../../messages/fr-CA.json";

type Params = { locale: string };

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<Params>;
}) {
  const { locale } = await params;
  if (!locales.includes(locale as "en-CA" | "fr-CA")) {
    notFound();
  }
  const messages = locale === "fr-CA" ? frMessages : enMessages;
  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}
