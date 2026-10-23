import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(["ar", "en"], locale)) notFound();
  setRequestLocale(locale);
  return (
    <NextIntlClientProvider messages={await getMessages()}>
      {children}
    </NextIntlClientProvider>
  );
}
