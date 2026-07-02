import { errorClass } from "../utils/auth-styles";

export function FieldError({ msg, dark, id }: { msg?: string; dark: boolean; id?: string }) {
  if (!msg) return null;
  return <p id={id} role="alert" aria-live="polite" className={errorClass(dark)}>{msg}</p>;
}
