import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { OpsApp } from "@/components/ops-app";
const routes = [
  "home",
  "login",
  "register",
  "activate",
  "forgot-password",
  "dashboard",
];
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; route?: string[] }>;
}) {
  const { locale, route } = await params;
  if (!["dashboard","login"].includes(route?.[0]??"")) return {};
  return {
    manifest: `/apps/${locale}.webmanifest`,
    appleWebApp: { capable: true, title: "OpsVision" },
    icons: { icon: "/apps/opsvision-pink-192.png", apple: "/apps/opsvision-pink-180.png" },
  };
}
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; route?: string[] }>;
}) {
  const { locale, route } = await params;
  const view = route?.[0] ?? "home";
  if (!routes.includes(view) || (route?.length ?? 0) > 1) notFound();
  if (
    view === "dashboard" &&
    !(await auth.api.getSession({ headers: await headers() }))
  )
    redirect(`/${locale}/login`);
  return <OpsApp view={view} />;
}
