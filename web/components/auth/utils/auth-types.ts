export type Mode = "login" | "register";
export type Theme = "light" | "dark";

export interface LoginPrefill {
  email: string;
  password: string;
}

export interface ContentProps {
  onSwitch: () => void;
  dark: boolean;
  onToggleTheme: () => void;
}

export interface LoginContentProps extends ContentProps {
  prefill?: LoginPrefill | null;
}

export interface RegisterContentProps extends ContentProps {
  onRegistered: (prefill: LoginPrefill) => void;
}
