import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, map, of, tap, throwError } from 'rxjs';
import { API_BASE_URL } from './api.config';

export interface SessionResponse {
  session_id: string;
  access_token: string;
  token_type: string;
  expires_in: number;
  audience: string;
}

@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly http = inject(HttpClient);
  private refreshTimer?: ReturnType<typeof setTimeout>;
  private readonly tokenSignal = signal<string | null>(null);
  private expiresAtMs = 0;

  readonly accessToken = this.tokenSignal.asReadonly();

  ensureSession(): Observable<void> {
    if (this.tokenSignal() && Date.now() < this.expiresAtMs - 5_000) {
      return of(undefined);
    }
    return this.createSession();
  }

  createSession(): Observable<void> {
    return this.http.post<SessionResponse>(`${API_BASE_URL}/session`, {}).pipe(
      tap((response) => this.applySession(response)),
      map(() => undefined),
      catchError((error) => throwError(() => error)),
    );
  }

  refreshSession(): Observable<void> {
    return this.createSession();
  }

  private applySession(response: SessionResponse): void {
    this.tokenSignal.set(response.access_token);
    this.expiresAtMs = Date.now() + response.expires_in * 1000;
    this.scheduleRefresh(response.expires_in);
  }

  private scheduleRefresh(expiresInSeconds: number): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }
    const refreshMs = Math.max((expiresInSeconds - 15) * 1000, 5_000);
    this.refreshTimer = setTimeout(() => {
      this.createSession().subscribe();
    }, refreshMs);
  }
}
