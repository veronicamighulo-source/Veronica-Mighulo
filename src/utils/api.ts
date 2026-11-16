const TOKEN_KEY = 'gambolin_player_token';
const ADMIN_PASSCODE_KEY = 'gambolin_admin_passcode';

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    // ignore storage restriction
  }
}

export function getStoredAdminPasscode(): string | null {
  try {
    return sessionStorage.getItem(ADMIN_PASSCODE_KEY);
  } catch {
    return null;
  }
}

export function setStoredAdminPasscode(passcode: string | null): void {
  try {
    if (passcode) {
      sessionStorage.setItem(ADMIN_PASSCODE_KEY, passcode);
    } else {
      sessionStorage.removeItem(ADMIN_PASSCODE_KEY);
    }
  } catch {
    // ignore storage restriction
  }
}

export async function apiRequest<T>(
  url: string,
  options: RequestInit & { adminPasscode?: string } = {}
): Promise<T> {
  const { adminPasscode, headers, ...rest } = options;
  const token = getStoredToken();

  const mergedHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(headers as Record<string, string> | undefined),
  };

  if (token) {
    mergedHeaders['Authorization'] = `Bearer ${token}`;
  }
  if (adminPasscode) {
    mergedHeaders['X-Admin-Passcode'] = adminPasscode;
  }

  const res = await fetch(url, {
    ...rest,
    headers: mergedHeaders,
    credentials: 'include',
  });

  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}
