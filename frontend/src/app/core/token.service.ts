import { Injectable } from '@angular/core';
import { AuthUser } from './auth.models';

const ACCESS_TOKEN_KEY = 'jblog.auth.accessToken';
const USER_KEY = 'jblog.auth.user';
const EXPIRES_AT_KEY = 'jblog.auth.expiresAt';

@Injectable({ providedIn: 'root' })
export class TokenService {
  get accessToken(): string | null {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  }

  get user(): AuthUser | null {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? (JSON.parse(raw) as AuthUser) : null;
    } catch {
      this.clear();
      return null;
    }
  }

  get isAuthenticated(): boolean {
    const token = this.accessToken;
    if (!token) {
      return false;
    }
    const expiresAt = Number(localStorage.getItem(EXPIRES_AT_KEY) ?? 0);
    return expiresAt > Date.now();
  }

  saveSession(accessToken: string, user: AuthUser): void {
    const expiresAt = this.getJwtExpiration(accessToken) ?? Date.now() + 60 * 60_000;
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    localStorage.setItem(EXPIRES_AT_KEY, String(expiresAt));
  }

  clear(): void {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(EXPIRES_AT_KEY);
  }

  private getJwtExpiration(accessToken: string): number | null {
    try {
      const payload = JSON.parse(
        atob(accessToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')),
      ) as { exp?: number };
      return payload.exp ? payload.exp * 1000 : null;
    } catch {
      return null;
    }
  }
}
