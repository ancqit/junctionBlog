import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, tap, throwError } from 'rxjs';
import { API_BASE_URL } from './api.config';
import {
  AuthUser,
  OtpRequestPayload,
  OtpRequestResponse,
  OtpVerifyPayload,
  TokenResponse,
} from './auth.models';
import { TokenService } from './token.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly tokens = inject(TokenService);

  private readonly userSignal = signal<AuthUser | null>(this.tokens.user);

  readonly user = this.userSignal.asReadonly();
  readonly isAuthenticated = computed(
    () => this.tokens.isAuthenticated && this.userSignal() !== null,
  );

  requestOtp(payload: OtpRequestPayload): Observable<OtpRequestResponse> {
    return this.http
      .post<OtpRequestResponse>(`${API_BASE_URL}/auth/otp/request`, payload)
      .pipe(catchError((error) => throwError(() => this.toError(error))));
  }

  verifyOtp(payload: OtpVerifyPayload): Observable<TokenResponse> {
    return this.http
      .post<TokenResponse>(`${API_BASE_URL}/auth/otp/verify`, payload)
      .pipe(
        tap((response) => this.acceptSession(response)),
        catchError((error) => throwError(() => this.toError(error))),
      );
  }

  logout(): void {
    this.tokens.clear();
    this.userSignal.set(null);
  }

  private acceptSession(response: TokenResponse): void {
    this.tokens.saveSession(response.access_token, response.user);
    this.userSignal.set(response.user);
  }

  private toError(error: unknown): Error {
    if (error instanceof HttpErrorResponse) {
      const detail = error.error?.detail;
      if (typeof detail === 'string' && detail.trim()) {
        if (detail.includes('GCP Identity Platform API key')) {
          return new Error(
            'OTP is unavailable: set GCP_IDENTITY_PLATFORM_API_KEY on junctionBack, then retry.',
          );
        }
        return new Error(detail);
      }
      if (Array.isArray(detail) && detail[0]?.msg) {
        return new Error(detail[0].msg);
      }
      if (error.status === 0) {
        return new Error('Unable to reach junctionBack. Check your network.');
      }
      return new Error(`Request failed (${error.status}). Please try again.`);
    }
    return error instanceof Error ? error : new Error('Something went wrong.');
  }
}
