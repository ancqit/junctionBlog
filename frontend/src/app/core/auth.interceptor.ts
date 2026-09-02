import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { API_BASE_URL } from './api.config';
import { TokenService } from './token.service';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const tokens = inject(TokenService);
  const isApiCall = request.url.startsWith(API_BASE_URL);
  const isAuthCall =
    request.url.includes('/auth/otp/') ||
    request.url.includes('/blog/auth/setup') ||
    request.url.includes('/blog/auth/login') ||
    request.url.includes('/blog/auth/charset');
  const isPublicBlog =
    request.method === 'GET' &&
    (request.url.includes('/blog/entries') ||
      request.url.includes('/blog/profiles') ||
      request.url.includes('/blog/auth/charset'));

  if (
    !isApiCall ||
    !tokens.accessToken ||
    isAuthCall ||
    isPublicBlog ||
    request.url.includes('/locations/') ||
    request.url.includes('/session')
  ) {
    return next(request);
  }

  return next(
    request.clone({
      setHeaders: { Authorization: `Bearer ${tokens.accessToken}` },
    }),
  );
};
