import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import "@fontsource/cairo/400.css";
import "@fontsource/cairo/500.css";
import "@fontsource/cairo/600.css";
import "@fontsource/cairo/700.css";
import "@fontsource/cairo/800.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "./globals.css";
import "./receipts.css";
export const metadata: Metadata = {
  icons: {icon:"/apps/opsvision-icon.png",apple:"/apps/opsvision-icon.png"},
  title: {
    default: "OpsVision | إدارة ومراقبة المغاسل",
    template: "%s | OpsVision",
  },
  description:
    "Arabic-first car wash operations management. Secure organizations, teams and wash workflows.",
};
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  return (
    <html lang={locale} dir={locale === "ar" ? "rtl" : "ltr"}>
      <body>{children}</body>
    </html>
  );
}
