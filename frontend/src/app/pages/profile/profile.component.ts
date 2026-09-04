import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { CharacterMapLockComponent } from '../../components/character-map-lock/character-map-lock.component';
import { HourDialComponent } from '../../components/hour-dial/hour-dial.component';
import { AuthService } from '../../core/auth.service';
import { BLOG_PIN_CHARSET_FALLBACK } from '../../core/auth.models';
import { BlogService } from '../../core/blog.service';
import { IdentityService } from '../../core/identity.service';
import {
  BlogProfile,
  DayKind,
  DayTemplate,
  HourBlock,
  WEEKDAYS,
} from '../../models/blog.models';
import {
  estimateSpan,
  overlapsExisting,
  sleepWakeBlocks,
  summarizeDay,
} from '../../lib/routine';

type PinMapMode = 'setup' | 'confirm' | 'current' | 'next' | 'confirm-new' | null;

@Component({
  selector: 'app-profile',
  imports: [FormsModule, RouterLink, HourDialComponent, CharacterMapLockComponent],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
})
export class ProfileComponent implements OnInit {
  private readonly identity = inject(IdentityService);
  private readonly blog = inject(BlogService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly weekdays = WEEKDAYS;
  readonly step = signal<1 | 2 | 3>(1);
  readonly dayKind = signal<DayKind>('active');
  readonly message = signal('');
  readonly pinError = signal('');
  readonly pinBusy = signal(false);
  readonly charset = signal<string[]>(BLOG_PIN_CHARSET_FALLBACK);
  readonly pinMapMode = signal<PinMapMode>(null);
  readonly currentPin = signal('');
  readonly pendingNewPin = signal('');
  readonly lockJustSet = signal(false);

  displayName = '';
  phoneNumber = '';

  sleepTime = '22:00';
  wakeTime = '06:00';
  primaryActivity = '';
  restDays = signal<number[]>([0]);
  startHour = 9;
  endHour = 12;
  blockActivity = '';
  blockKind: HourBlock['kind'] = 'active';

  readonly activeDay = signal<DayTemplate>({ type: 'active', blocks: [] });
  readonly restDay = signal<DayTemplate>({ type: 'rest', blocks: [] });

  readonly day = computed(() => (this.dayKind() === 'active' ? this.activeDay() : this.restDay()));
  readonly summary = computed(() => summarizeDay(this.day()));
  readonly span = computed(() => estimateSpan(this.restDays(), this.activeDay(), this.restDay()));
  readonly unlocked = computed(() => this.auth.isAuthenticated());

  ngOnInit(): void {
    const who = this.identity.identity();
    if (who) {
      this.displayName = who.displayName;
      this.phoneNumber = who.phoneNumber?.replace(/^\+91/, '') ?? '';
      const existing = this.blog.profileFor(who.userNumber);
      if (existing) {
        this.sleepTime = existing.sleepTime;
        this.wakeTime = existing.wakeTime;
        this.primaryActivity = existing.primaryActivity;
        this.restDays.set([...existing.restDays]);
        this.activeDay.set({
          type: 'active',
          blocks: existing.activeDay.blocks.map((block) => ({ ...block })),
        });
        this.restDay.set({
          type: 'rest',
          blocks: existing.restDay.blocks.map((block) => ({ ...block })),
        });
      }
    }
    this.auth.getCharset().subscribe((res) => this.charset.set(res.characters));
  }

  get who() {
    return this.identity.identity();
  }

  get e164Phone(): string {
    return `+91${this.phoneNumber.trim().replace(/\s+/g, '')}`;
  }

  saveIdentity(): boolean {
    this.pinError.set('');
    const name = this.displayName.trim();
    const phone = this.phoneNumber.trim().replace(/\s+/g, '');
    if (!name) {
      this.pinError.set('Enter your name.');
      return false;
    }
    if (!/^[6-9]\d{9}$/.test(phone)) {
      this.pinError.set('Enter a valid 10-digit Indian mobile number.');
      return false;
    }
    this.identity.enter(name, phone);
    return true;
  }

  startPinSetup(): void {
    if (!this.saveIdentity()) {
      return;
    }
    this.lockJustSet.set(false);
    this.pendingNewPin.set('');
    this.pinMapMode.set('setup');
  }

  startPinUpdate(): void {
    if (!this.auth.isAuthenticated()) {
      this.pinError.set('Unlock on Login first, then update your PIN here.');
      return;
    }
    this.pinError.set('');
    this.lockJustSet.set(false);
    this.currentPin.set('');
    this.pendingNewPin.set('');
    this.pinMapMode.set('current');
  }

  onPinMapDismiss(): void {
    this.pinMapMode.set(null);
    this.currentPin.set('');
    this.pendingNewPin.set('');
  }

  onPinMapComplete(pin: string): void {
    const mode = this.pinMapMode();
    if (mode === 'setup') {
      this.pendingNewPin.set(pin);
      this.pinMapMode.set('confirm');
      return;
    }
    if (mode === 'confirm') {
      if (pin !== this.pendingNewPin()) {
        this.pinError.set('PINs did not match. Choose 4 characters again.');
        this.pendingNewPin.set('');
        this.pinMapMode.set('setup');
        return;
      }
      this.submitSetup(pin);
      return;
    }
    if (mode === 'current') {
      this.currentPin.set(pin);
      this.pinMapMode.set('next');
      return;
    }
    if (mode === 'next') {
      this.pendingNewPin.set(pin);
      this.pinMapMode.set('confirm-new');
      return;
    }
    if (mode === 'confirm-new') {
      if (pin !== this.pendingNewPin()) {
        this.pinError.set('New PINs did not match. Try again.');
        this.pendingNewPin.set('');
        this.pinMapMode.set('next');
        return;
      }
      this.pinBusy.set(true);
      this.auth
        .updatePin(this.currentPin(), pin)
        .pipe(finalize(() => this.pinBusy.set(false)))
        .subscribe({
          next: () => {
            this.pinMapMode.set(null);
            this.currentPin.set('');
            this.pendingNewPin.set('');
            this.pinError.set('');
            this.message.set('PIN updated.');
          },
          error: (err: Error) => {
            this.pinError.set(err.message);
            this.pinMapMode.set(null);
          },
        });
    }
  }

  logout(): void {
    this.auth.logout();
    this.lockJustSet.set(false);
    this.message.set('Logged out.');
    void this.router.navigateByUrl('/');
  }

  goLogin(): void {
    void this.router.navigateByUrl('/login');
  }

  pinMapTitle(): string {
    switch (this.pinMapMode()) {
      case 'setup':
        return 'Set your 4-character PIN';
      case 'confirm':
        return 'Repeat the same 4 characters';
      case 'current':
        return 'Enter current PIN';
      case 'next':
        return 'Choose a new 4-character PIN';
      case 'confirm-new':
        return 'Confirm new PIN';
      default:
        return 'Character lock';
    }
  }

  pinMapSubtitle(): string {
    switch (this.pinMapMode()) {
      case 'setup':
        return 'Open the map and pick four characters. You’ll confirm them next.';
      case 'confirm':
        return 'Select the same sequence again to lock it in.';
      case 'current':
        return 'Enter your current four characters to continue.';
      case 'next':
      case 'confirm-new':
        return 'Select four characters from the map.';
      default:
        return '';
    }
  }

  pinConfirmLabel(): string {
    const mode = this.pinMapMode();
    if (mode === 'confirm' || mode === 'confirm-new') {
      return this.pinBusy() ? 'Saving…' : 'Save PIN';
    }
    return 'Continue';
  }

  toggleRestDay(day: number): void {
    if (this.restDays().includes(day)) {
      this.restDays.set(this.restDays().filter((item) => item !== day));
    } else {
      this.restDays.set([...this.restDays(), day].sort());
    }
  }

  goQuestion2(): void {
    if (!this.sleepTime || !this.wakeTime) {
      this.message.set('set sleep and wake times.');
      return;
    }
    this.message.set('');
    this.step.set(2);
  }

  goQuestion3(): void {
    if (!this.primaryActivity.trim()) {
      this.message.set('set the activity you keep returning to.');
      return;
    }
    this.seedSleepIfNeeded();
    this.message.set('');
    this.step.set(3);
  }

  onRange(range: { startHour: number; endHour: number }): void {
    this.startHour = range.startHour;
    this.endHour = range.endHour;
  }

  addBlock(): void {
    const activity = this.blockActivity.trim() || this.primaryActivity.trim();
    if (!activity) {
      this.message.set('name the activity for these hours.');
      return;
    }
    const template = this.mutableDay();
    if (overlapsExisting(template.blocks, this.startHour, this.endHour)) {
      this.message.set('those hours are already declared. pick a free range to club.');
      return;
    }
    const next: DayTemplate = {
      ...template,
      blocks: [
        ...template.blocks,
        {
          startHour: this.startHour,
          endHour: this.endHour,
          activity,
          kind: this.blockKind,
        },
      ].sort((a, b) => a.startHour - b.startHour),
    };
    this.writeDay(next);
    this.message.set('');
    this.blockActivity = '';
  }

  removeBlock(index: number): void {
    const template = this.mutableDay();
    this.writeDay({
      ...template,
      blocks: template.blocks.filter((_, i) => i !== index),
    });
  }

  async save(): Promise<void> {
    let who = this.identity.identity();
    if (!who) {
      if (!this.saveIdentity()) {
        return;
      }
      who = this.identity.identity();
    }
    if (!who) {
      return;
    }
    const profile: BlogProfile = {
      userNumber: who.userNumber,
      displayName: who.displayName,
      phoneNumber: who.phoneNumber,
      nameTag: who.nameTag,
      sleepTime: this.sleepTime,
      wakeTime: this.wakeTime,
      primaryActivity: this.primaryActivity.trim(),
      restDays: this.restDays(),
      activeDay: this.activeDay(),
      restDay: this.restDay(),
      updatedAt: new Date().toISOString(),
    };
    await this.blog.saveProfile(profile);
    this.message.set('profile saved. week is enough to estimate month and year.');
  }

  private submitSetup(pin: string): void {
    this.pinBusy.set(true);
    this.pinError.set('');
    this.auth
      .setupPin(this.e164Phone, pin, this.displayName.trim() || undefined)
      .pipe(finalize(() => this.pinBusy.set(false)))
      .subscribe({
        next: () => {
          this.pinMapMode.set(null);
          this.pendingNewPin.set('');
          this.lockJustSet.set(true);
          this.message.set('Character lock set. You can unlock anytime from Login.');
        },
        error: (err: Error) => {
          this.pinError.set(err.message);
          this.pinMapMode.set(null);
          this.pendingNewPin.set('');
          if (/already has a pin/i.test(err.message)) {
            this.message.set('This number already has a lock — unlock on Login instead.');
          }
        },
      });
  }

  private seedSleepIfNeeded(): void {
    const sleep = sleepWakeBlocks(this.sleepTime, this.wakeTime);
    if (!this.activeDay().blocks.length) {
      this.activeDay.set({ type: 'active', blocks: sleep.map((block) => ({ ...block })) });
    }
    if (!this.restDay().blocks.length) {
      this.restDay.set({ type: 'rest', blocks: sleep.map((block) => ({ ...block })) });
    }
  }

  private mutableDay(): DayTemplate {
    return this.dayKind() === 'active' ? this.activeDay() : this.restDay();
  }

  private writeDay(template: DayTemplate): void {
    if (this.dayKind() === 'active') {
      this.activeDay.set(template);
    } else {
      this.restDay.set(template);
    }
  }
}
