import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CookieNoticeComponent } from './components/cookie-notice/cookie-notice.component';
import { AuthService } from './core/auth.service';
import { IdentityService } from './core/identity.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CookieNoticeComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly identity = inject(IdentityService);
  readonly unlocked = computed(() => this.auth.isAuthenticated());
  readonly year = new Date().getFullYear();

  logout(): void {
    this.auth.logout();
    void this.router.navigateByUrl('/');
  }
}
