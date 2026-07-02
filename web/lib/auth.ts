import api from './api';

export interface User {
  id: string;
  email: string;
  name?: string;
  last_name?: string;
  avatar_url?: string;
}

export interface AuthCredentials {
  email: string;
  password: string;
}

export interface RegisterPayload {
  name: string;
  last_name: string;
  email: string;
  password: string;
}

export const authApi = {
  register: (data: RegisterPayload) =>
    api.post<User>('/auth/register', data).then((r) => r.data),

  login: (data: AuthCredentials) =>
    api.post<User>('/auth/login', data).then((r) => r.data),

  logout: () =>
    api.post<{ authenticated: boolean }>('/auth/logout').then((r) => r.data),

  refresh: () =>
    api.post<{ authenticated: boolean }>('/auth/refresh').then((r) => r.data),

  getMe: () =>
    api.get<User>('/users/me').then((r) => r.data),

  forgotPassword: (email: string) =>
    fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    }).then(async (r) => {
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error ?? 'Erro ao enviar e-mail.');
      return data;
    }),

  verifyResetCode: (email: string, code: string) =>
    fetch('/api/auth/verify-reset-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code }),
    }).then(async (r) => {
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error ?? 'Código inválido.');
      return data;
    }),

  resetPassword: (token: string, password: string) =>
    fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    }).then(async (r) => {
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error ?? 'Falha ao redefinir senha.');
      return data;
    }),

  updateProfile: (data: Partial<Pick<User, 'name' | 'last_name'>> & { job_title?: string }) =>
    api.patch<User & { job_title?: string }>('/users/me', data).then((r) => r.data),

  changePassword: (currentPassword: string, newPassword: string) =>
    api.post<void>('/users/me/password', {
      current_password: currentPassword,
      new_password: newPassword,
    }).then(() => undefined),

  deleteAccount: () =>
    api.delete<void>('/users/me').then(() => undefined),

  uploadAvatar: (file: File) => {
    const form = new FormData();
    form.append('avatar', file);
    return api.patch<User>('/users/me/avatar', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data);
  },
};
