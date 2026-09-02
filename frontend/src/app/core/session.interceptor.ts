import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { API_BASE_URL } from './api.config';
import { SessionService } from './session.service';

function isLocationsRequest(url: string): boolean {
  return url.includes('/locations/');
}

function isSessionCreate(url: string, method: string): boolean {
  return method === 'POST' && (url.endsWith('/session') || url.includes('/session?'));
}

export const sessionInterceptor: HttpInterceptorFn = (request, next) => {
  const session = inject(SessionService);
  const token = session.accessToken();
  const isApi = request.url.startsWith(API_BASE_URL);

  let outgoing = request;
  if (token && isApi && isLocationsRequest(request.url) && !isSessionCreate(request.url, request.method)) {
    outgoing = request.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    });
  }

  return next(outgoing).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status !== 401 || !isLocationsRequest(request.url) || isSessionCreate(request.url, request.method)) {
        return throwError(() => error);
      }
      return session.refreshSession().pipe(
        switchMap(() => {
          const refreshed = session.accessToken();
          if (!refreshed) {
            return throwError(() => error);
          }
          return next(
            request.clone({
              setHeaders: { Authorization: `Bearer ${refreshed}` },
            }),
          );
        }),
      );
    }),
  );
};
