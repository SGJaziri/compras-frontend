// src/services/auth.ts
import { apiFetch, setToken, getToken } from './http';

type LoginResponse = { token: string } & Record<string, any>;
type ChangePwdResponse = { detail?: string } & Record<string, any>;

export async function login(username: string, password: string): Promise<LoginResponse> {
  // apiFetch devuelve JSON o lanza Error(message)
  const data = await apiFetch('/api/auth/login/', {
    method: 'POST',
    body: { username: username.trim(), password },   // ← NO uses JSON.stringify aquí; apiFetch serializa
  }) as LoginResponse;

  if (!data?.token) throw new Error('Credenciales inválidas');
  setToken(data.token);
  return data;
}

export function logout() {
  setToken(null);
}

export function isLoggedIn(): boolean {
  return !!getToken();
}

/**
 * Cambiar contraseña.
 * Tu ChangePasswordView espera: { current_password, new_password }
 * apiFetch ya añade Authorization y serializa JSON si hace falta.
 */
export async function changePassword(
  current_password: string,
  new_password: string
): Promise<ChangePwdResponse> {
  const data = await apiFetch('/api/auth/change-password/', {
    method: 'POST',
    body: { current_password, new_password },  // ← nombres exactos
  }) as ChangePwdResponse;

  return data; // p.ej. { detail: 'Contraseña actualizada correctamente.' }
}
