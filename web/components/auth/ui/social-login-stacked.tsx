"use client";

import { useToast } from "@/components/ui/toast";
import { GoogleIcon, GovBrWordmark, MicrosoftIcon } from "./social-icons";

// Stacked variant — used on the login page, where the column has room to
// breathe. Full-width buttons with generous vertical rhythm fill the space
// below the primary action instead of leaving it blank.
export function SocialLoginStacked({ dark }: { dark: boolean }) {
  const { show: showToast } = useToast();

  const providers = [
    {
      name: "Google",
      content: (
        <>
          <GoogleIcon size={20} />
          <span>Entrar com Google</span>
        </>
      ),
    },
    {
      name: "gov.br",
      content: (
        <>
          <span>Entrar com</span>
          <GovBrWordmark dark={dark} />
        </>
      ),
    },
    {
      name: "Microsoft",
      content: (
        <>
          <MicrosoftIcon size={20} />
          <span>Entrar com Microsoft</span>
        </>
      ),
    },
  ] as const;

  const buttonClass =
    "flex w-full items-center justify-center gap-3 py-[17px] text-[15px] font-medium rounded-lg border cursor-pointer transition-colors duration-500 focus-visible:outline-none focus-visible:ring-2 " +
    (dark
      ? "bg-[#141414] text-[#f0f0f0] border-[#2a2a2a] hover:border-[#3a3a3a] hover:bg-[#1a1a1a] active:bg-[#202020] focus-visible:ring-[#2ec98d]/40"
      : "bg-white text-[#1b3630] border-[#b8d9d0] hover:border-[#8fb8ad] hover:bg-[#f6fdfa] active:bg-[#ecfaf4] focus-visible:ring-[#15a37b]/40");

  const dividerLine =
    "h-px flex-1 transition-colors duration-500 " +
    (dark ? "bg-[#2a2a2a]" : "bg-[#b8d9d0]");

  return (
    <div className="mt-10">
      <div className="flex items-center gap-4" aria-hidden="true">
        <span className={dividerLine} />
        <span
          className={`text-sm transition-colors duration-500 ${dark ? "text-[#888]" : "text-[#52665f]"}`}
        >
          ou entre com
        </span>
        <span className={dividerLine} />
      </div>

      <div className="mt-8 flex flex-col gap-4">
        {providers.map((p) => (
          <button
            key={p.name}
            type="button"
            aria-label={`Entrar com ${p.name}`}
            className={buttonClass}
            onClick={() =>
              showToast(`Login com ${p.name} estará disponível em breve.`, {
                duration: 4000,
              })
            }
          >
            {p.content}
          </button>
        ))}
      </div>
    </div>
  );
}
