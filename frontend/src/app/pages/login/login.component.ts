import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { CharacterMapLockComponent } from '../../components/character-map-lock/character-map-lock.component';
import { AuthService } from '../../core/auth.service';
import { BLOG_PIN_CHARSET_FALLBACK, BLOG_PIN_LENGTH } from '../../core/auth.models';

type GateMode = 'choose' | 'new-phone' | 'old-phone' | 'old-set-phone';
type MapMode = 'setup' | 'confirm' | 'unlock' | null;

@Component({
  selector: 'app-login',
  imports: [FormsModule, CharacterMapLockComponent],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  displayName = '';
  phoneNumber = '';

  readonly gate = signal<GateMode>('choose');
  readonly mapMode = signal<MapMode>(null);
  readonly pendingPin = signal('');
  readonly charset = signal<string[]>(BLOG_PIN_CHARSET_FALLBACK);
  readonly error = signal('');
  readonly submitting = signal(false);

  readonly pinLength = BLOG_PIN_LENGTH;

  ngOnInit(): void {
    this.auth.getCharset().subscribe((res) => this.charset.set(res.characters));
  }

  get e164Phone(): string {
    return `+91${this.phoneNumber.trim().replace(/\s+/g, '')}`;
  }

  chooseNew(): void {
    this.error.set('');
    this.gate.set('new-phone');
  }

  chooseOld(): void {
    this.error.set('');
    this.gate.set('old-phone');
  }

  chooseOldSetPin(): void {
    this.error.set('');
    this.gate.set('old-set-phone');
  }

  backToChoose(): void {
    this.error.set('');
    this.mapMode.set(null);
    this.pendingPin.set('');
    this.gate.set('choose');
  }

  startNewSetup(): void {
    if (!this.validPhoneAndName(true)) {
      return;
    }
    this.mapMode.set('setup');
  }

  startOldUnlock(): void {
    if (!this.validPhoneAndName(false)) {
      return;
    }
    this.mapMode.set('unlock');
  }

  startOldSetPin(): void {
    if (!this.validPhoneAndName(false)) {
      return;
    }
    this.mapMode.set('setup');
  }

  onMapDismiss(): void {
    this.mapMode.set(null);
    this.pendingPin.set('');
  }

  onMapComplete(pin: string): void {
    const mode = this.mapMode();
    if (mode === 'setup') {
      this.pendingPin.set(pin);
      this.mapMode.set('confirm');
      return;
    }
    if (mode === 'confirm') {
      if (pin !== this.pendingPin()) {
        this.error.set('PINs did not match. Choose 4 characters again.');
        this.pendingPin.set('');
        this.mapMode.set('setup');
        return;
      }
      this.submitSetup(pin);
      return;
    }
    if (mode === 'unlock') {
      this.submitLogin(pin);
    }
  }

  private submitSetup(pin: string): void {
    this.submitting.set(true);
    this.error.set('');
    this.auth
      .setupPin(this.e164Phone, pin, this.displayName.trim() || undefined)
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: () => {
          this.mapMode.set(null);
          void this.router.navigateByUrl('/');
        },
        error: (err: Error) => {
          this.error.set(err.message);
          this.mapMode.set(null);
          this.pendingPin.set('');
        },
      });
  }

  private submitLogin(pin: string): void {
    this.submitting.set(true);
    this.error.set('');
    this.auth
      .loginPin(this.e164Phone, pin)
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: () => {
          this.mapMode.set(null);
          void this.router.navigateByUrl('/');
        },
        error: (err: Error) => {
          this.error.set(err.message);
          this.mapMode.set(null);
        },
      });
  }

  private validPhoneAndName(requireName: boolean): boolean {
    this.error.set('');
    const phone = this.phoneNumber.trim().replace(/\s+/g, '');
    if (requireName && !this.displayName.trim()) {
      this.error.set('Enter your name.');
      return false;
    }
    if (!/^[6-9]\d{9}$/.test(phone)) {
      this.error.set('Enter a valid 10-digit Indian mobile number.');
      return false;
    }
    return true;
  }

  mapTitle(): string {
    switch (this.mapMode()) {
      case 'setup':
        return 'Set your 4-character PIN';
      case 'confirm':
        return 'Repeat the same 4 characters';
      case 'unlock':
        return 'Enter your PIN';
      default:
        return 'Character lock';
    }
  }

  mapSubtitle(): string {
    switch (this.mapMode()) {
      case 'setup':
        return 'Open the map and pick four characters. You’ll confirm them next.';
      case 'confirm':
        return 'Select the same sequence again to lock it in.';
      case 'unlock':
        return 'Pick your four characters from the map to unlock.';
      default:
        return '';
    }
  }

  mapConfirmLabel(): string {
    if (this.mapMode() === 'confirm') {
      return this.submitting() ? 'Saving…' : 'Save PIN';
    }
    if (this.mapMode() === 'unlock') {
      return this.submitting() ? 'Unlocking…' : 'Unlock';
    }
    return 'Continue';
  }
}
