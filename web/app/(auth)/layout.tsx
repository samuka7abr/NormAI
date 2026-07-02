import { LogoLoaderClient } from "@/components/auth/loaders/logo-loader-client";
import { cookies } from "next/headers";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const theme = cookieStore.get("normai-theme")?.value;
  const bg = theme === "dark" ? "#0a0a0a" : "#F0FDF9";

  return (
    <>
      <LogoLoaderClient />
      <div
        className="auth-layout min-h-screen flex items-center justify-center p-0 md:p-5"
        style={{ background: `var(--auth-page-bg, ${bg})` }}
      >
        {children}
      </div>
    </>
  );
}
