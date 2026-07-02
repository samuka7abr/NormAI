"use client";

import { useToast } from "@/components/ui/toast";
import { GoogleIcon, GovBrWordmark, MicrosoftIcon } from "./social-icons";

// Compact row variant — used on the register page, where the form is dense.
export function SocialLogin({ dark }: { dark: boolean }) {
  const { show: showToast } = useToast();

  const providers = [
    { name: "Google", icon: <GoogleIcon />, label: "Google" },
    { name: "gov.br", icon: null, label: <GovBrWordmark dark={dark} /> },
    { name: "Microsoft", icon: <MicrosoftIcon />, label: "Microsoft" },
  ] as const;

  const buttonClass =
    "flex flex-1 items-center justify-center gap-2 py-[13px] text-sm font-medium rounded-lg border cursor-pointer transition-colors duration-500 focus-visible:outline-none focus-visible:ring-2 " +
    (dark
      ? "bg-[#141414] text-[#f0f0f0] border-[#2a2a2a] hover:border-[#3a3a3a] hover:bg-[#1a1a1a] active:bg-[#202020] focus-visible:ring-[#2ec98d]/40"
      : "bg-white text-[#1b3630] border-[#b8d9d0] hover:border-[#8fb8ad] hover:bg-[#f6fdfa] active:bg-[#ecfaf4] focus-visible:ring-[#15a37b]/40");

  const dividerLine =
    "h-px flex-1 transition-colors duration-500 " +
    (dark ? "bg-[#2a2a2a]" : "bg-[#b8d9d0]");

  return (
    <div className="mt-6">
      <div className="flex items-center gap-4" aria-hidden="true">
        <span className={dividerLine} />
        <span
          className={`text-sm transition-colors duration-500 ${dark ? "text-[#888]" : "text-[#52665f]"}`}
        >
          ou cadastre-se com
        </span>
        <span className={dividerLine} />
      </div>

      <div className="mt-5 flex flex-col sm:flex-row gap-3">
        {providers.map((p) => (
          <button
            key={p.name}
            type="button"
            aria-label={`Cadastrar com ${p.name}`}
            className={buttonClass}
            onClick={() =>
              showToast(`Cadastro com ${p.name} estará disponível em breve.`, {
                duration: 4000,
              })
            }
          >
            {p.icon}
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}
