import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { CharacterMapLockComponent } from '../../components/character-map-lock/character-map-lock.component';
import { AuthService } from '../../core/auth.service';
import { BLOG_PIN_CHARSET_FALLBACK } from '../../core/auth.models';
import { IdentityService } from '../../core/identity.service';

@Component({
  selector: 'app-login',
  imports: [FormsModule, RouterLink, CharacterMapLockComponent],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly identity = inject(IdentityService);
  private readonly router = inject(Router);

  phoneNumber = '';

  readonly mapOpen = signal(false);
  readonly charset = signal<string[]>(BLOG_PIN_CHARSET_FALLBACK);
  readonly error = signal('');
  readonly submitting = signal(false);
  readonly suggestProfile = signal(false);

  ngOnInit(): void {
    if (this.auth.isAuthenticated()) {
      void this.router.navigateByUrl('/');
      return;
    }
    const phone = this.identity.identity()?.phoneNumber?.replace(/^\+91/, '') ?? '';
    if (phone) {
      this.phoneNumber = phone;
    }
    this.auth.getCharset().subscribe((res) => this.charset.set(res.characters));
  }

  get e164Phone(): string {
    return `+91${this.phoneNumber.trim().replace(/\s+/g, '')}`;
  }

  startUnlock(): void {
    if (!this.validPhone()) {
      return;
    }
    this.suggestProfile.set(false);
    this.mapOpen.set(true);
  }

  onMapDismiss(): void {
    this.mapOpen.set(false);
  }

  onMapComplete(pin: string): void {
    this.submitLogin(pin);
  }

  goToProfile(): void {
    void this.router.navigateByUrl('/profile');
  }

  private submitLogin(pin: string): void {
    this.submitting.set(true);
    this.error.set('');
    this.suggestProfile.set(false);
    this.auth
      .loginPin(this.e164Phone, pin)
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: () => {
          this.mapOpen.set(false);
          void this.router.navigateByUrl('/');
        },
        error: (err: Error) => {
          this.mapOpen.set(false);
          const message = err.message || 'Could not unlock.';
          this.error.set(message);
          // Same 401 for missing lock vs wrong PIN — gently point new users to Profile.
          if (/invalid phone or pin/i.test(message)) {
            this.suggestProfile.set(true);
          }
        },
      });
  }

  private validPhone(): boolean {
    this.error.set('');
    this.suggestProfile.set(false);
    const phone = this.phoneNumber.trim().replace(/\s+/g, '');
    if (!/^[6-9]\d{9}$/.test(phone)) {
      this.error.set('Enter a valid 10-digit Indian mobile number.');
      return false;
    }
    return true;
  }
}
