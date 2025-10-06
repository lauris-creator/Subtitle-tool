const USER_KEY = 'srt-editor-user';

export type StoredUser = {
  sub: string;
  name?: string;
  email?: string;
  picture?: string;
};

export function saveUser(user: StoredUser) {
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {}
}

export function loadUser(): StoredUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as StoredUser) : null;
  } catch {
    return null;
  }
}

export function clearUser() {
  try {
    localStorage.removeItem(USER_KEY);
  } catch {}
}


