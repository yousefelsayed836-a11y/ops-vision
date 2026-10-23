import createMiddleware from "next-intl/middleware";
export default createMiddleware({
  locales: ["ar", "en"],
  defaultLocale: "ar",
  localePrefix: "always",
});
export const config = {
  matcher: ["/((?!api|_next|assets|favicon.ico|.*\\..*).*)"],
};
