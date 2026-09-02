import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { RECAPTCHA_TOKEN_PLACEHOLDER } from '../../core/api.config';
import { AuthService } from '../../core/auth.service';
import { IdentityService } from '../../core/identity.service';

@Component({
  selector: 'app-login',
  imports: [FormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly identity = inject(IdentityService);
  private readonly router = inject(Router);

  displayName = '';
  phoneNumber = '';
  otp = '';

  readonly step = signal<'details' | 'otp'>('details');
  readonly error = signal('');
  readonly submitting = signal(false);
  readonly sessionInfo = signal('');
  readonly expiresInSeconds = signal(300);
  readonly debugOtp = signal('');

  get e164Phone(): string {
    return `+91${this.phoneNumber.trim().replace(/\s+/g, '')}`;
  }

  sendOtp(): void {
    this.error.set('');
    const displayName = this.displayName.trim();
    const phone = this.phoneNumber.trim().replace(/\s+/g, '');
    if (!displayName) {
      this.error.set('enter your name.');
      return;
    }
    if (!/^[6-9]\d{9}$/.test(phone)) {
      this.error.set('enter a valid 10-digit Indian mobile number.');
      return;
    }
    this.submitting.set(true);
    this.auth
      .requestOtp({
        display_name: displayName,
        phone_number: `+91${phone}`,
        recaptcha_token: RECAPTCHA_TOKEN_PLACEHOLDER,
      })
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: (response) => {
          this.sessionInfo.set(response.session_info);
          this.expiresInSeconds.set(response.expires_in_seconds);
          this.debugOtp.set(response.debug_otp?.trim() ?? '');
          this.otp = response.debug_otp?.trim() ?? '';
          this.step.set('otp');
        },
        error: (err: Error) => this.error.set(err.message),
      });
  }

  verifyOtp(): void {
    this.error.set('');
    const code = this.otp.trim();
    if (!/^\d{6}$/.test(code)) {
      this.error.set('enter the 6-digit OTP.');
      return;
    }
    this.submitting.set(true);
    this.auth
      .verifyOtp({
        phone_number: this.e164Phone,
        otp: code,
        session_info: this.sessionInfo(),
      })
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: (response) => {
          this.identity.enter(response.user.display_name, response.user.phone_number);
          void this.router.navigateByUrl('/');
        },
        error: (err: Error) => this.error.set(err.message),
      });
  }
}
