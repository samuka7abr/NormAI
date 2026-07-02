"use client";

import dynamic from "next/dynamic";

export const LogoLoaderClient = dynamic(
  () =>
    import("@/components/auth/loaders/logo-loader").then((m) => ({
      default: m.LogoLoader,
    })),
  { ssr: false },
);
