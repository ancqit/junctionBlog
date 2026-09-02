import { ApplicationConfig, inject, provideAppInitializer, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { catchError, of } from 'rxjs';

import { routes } from './app.routes';
import { authInterceptor } from './core/auth.interceptor';
import { sessionInterceptor } from './core/session.interceptor';
import { SessionService } from './core/session.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor, sessionInterceptor])),
    provideAppInitializer(() => {
      const session = inject(SessionService);
      return session.ensureSession().pipe(catchError(() => of(undefined)));
    }),
  ],
};
