export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type LoginErrors = { email?: string; password?: string };

export type RegisterErrors = {
  firstName?: string;
  lastName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
};

export function validateLogin(email: string, password: string): LoginErrors {
  const e: LoginErrors = {};
  if (!email.trim()) e.email = "Informe seu e-mail.";
  else if (!EMAIL_RE.test(email)) e.email = "E-mail inválido.";
  if (!password) e.password = "Informe sua senha.";
  return e;
}

export function validateRegister(fields: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
}): RegisterErrors {
  const e: RegisterErrors = {};
  if (!fields.firstName.trim()) e.firstName = "Informe seu nome.";
  if (!fields.lastName.trim()) e.lastName = "Informe seu sobrenome.";
  if (!fields.email.trim()) e.email = "Informe seu e-mail.";
  else if (!EMAIL_RE.test(fields.email)) e.email = "E-mail inválido.";
  if (!fields.password) e.password = "Crie uma senha.";
  else if (fields.password.length < 8) e.password = "Mínimo de 8 caracteres.";
  if (!fields.confirmPassword) e.confirmPassword = "Confirme sua senha.";
  else if (fields.confirmPassword !== fields.password) e.confirmPassword = "As senhas não coincidem.";
  return e;
}
