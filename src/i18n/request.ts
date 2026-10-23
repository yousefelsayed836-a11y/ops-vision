import { getRequestConfig } from "next-intl/server";
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = requested === "en" ? "en" : "ar";
  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
