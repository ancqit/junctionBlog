import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, map, of, tap, throwError } from 'rxjs';
import { API_BASE_URL } from './api.config';
import {
  BLOG_PIN_CHARSET_FALLBACK,
  BLOG_PIN_LENGTH,
  BlogAuthUser,
  BlogTokenResponse,
  CharsetResponse,
} from './auth.models';
import { IdentityService } from './identity.service';
import { TokenService } from './token.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly tokens = inject(TokenService);
  private readonly identity = inject(IdentityService);

  private readonly userSignal = signal<BlogAuthUser | null>(this.tokens.user as BlogAuthUser | null);
  private charsetCache: string[] | null = null;

  readonly user = this.userSignal.asReadonly();
  readonly isAuthenticated = computed(
    () => this.tokens.isAuthenticated && this.userSignal() !== null,
  );

  getCharset(): Observable<CharsetResponse> {
    if (this.charsetCache) {
      return of({ characters: this.charsetCache, pin_length: BLOG_PIN_LENGTH });
    }
    return this.http.get<CharsetResponse>(`${API_BASE_URL}/blog/auth/charset`).pipe(
      tap((res) => {
        this.charsetCache = res.characters?.length ? res.characters : BLOG_PIN_CHARSET_FALLBACK;
      }),
      map((res) => ({
        characters: res.characters?.length ? res.characters : BLOG_PIN_CHARSET_FALLBACK,
        pin_length: res.pin_length || BLOG_PIN_LENGTH,
      })),
      catchError(() =>
        of({ characters: BLOG_PIN_CHARSET_FALLBACK, pin_length: BLOG_PIN_LENGTH }),
      ),
    );
  }

  setupPin(phoneNumber: string, pin: string, displayName?: string): Observable<BlogTokenResponse> {
    return this.http
      .post<BlogTokenResponse>(`${API_BASE_URL}/blog/auth/setup`, {
        phone_number: phoneNumber,
        pin,
        display_name: displayName || undefined,
      })
      .pipe(
        tap((response) => this.acceptSession(response)),
        catchError((error) => throwError(() => this.toError(error))),
      );
  }

  loginPin(phoneNumber: string, pin: string): Observable<BlogTokenResponse> {
    return this.http
      .post<BlogTokenResponse>(`${API_BASE_URL}/blog/auth/login`, {
        phone_number: phoneNumber,
        pin,
      })
      .pipe(
        tap((response) => this.acceptSession(response)),
        catchError((error) => throwError(() => this.toError(error))),
      );
  }

  updatePin(currentPin: string, newPin: string): Observable<BlogTokenResponse> {
    return this.http
      .post<BlogTokenResponse>(`${API_BASE_URL}/blog/auth/update-pin`, {
        current_pin: currentPin,
        new_pin: newPin,
      })
      .pipe(
        tap((response) => this.acceptSession(response)),
        catchError((error) => throwError(() => this.toError(error))),
      );
  }

  logout(): void {
    this.tokens.clear();
    this.userSignal.set(null);
    this.identity.clear();
  }

  private acceptSession(response: BlogTokenResponse): void {
    const user: BlogAuthUser = response.user;
    this.tokens.saveSession(response.access_token, {
      id: user.id,
      phone_number: user.phone_number,
      display_name: user.display_name,
      user_number: user.user_number,
      email: null,
    });
    this.userSignal.set(user);
    this.identity.enter(user.display_name, user.phone_number);
  }

  private toError(error: unknown): Error {
    if (error instanceof HttpErrorResponse) {
      const detail = error.error?.detail;
      if (typeof detail === 'string' && detail.trim()) {
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
