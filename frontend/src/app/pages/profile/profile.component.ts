import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HourDialComponent } from '../../components/hour-dial/hour-dial.component';
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

@Component({
  selector: 'app-profile',
  imports: [FormsModule, RouterLink, HourDialComponent],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
})
export class ProfileComponent implements OnInit {
  private readonly identity = inject(IdentityService);
  private readonly blog = inject(BlogService);
  private readonly router = inject(Router);

  readonly weekdays = WEEKDAYS;
  readonly step = signal<1 | 2 | 3>(1);
  readonly dayKind = signal<DayKind>('active');
  readonly message = signal('');

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

  ngOnInit(): void {
    const who = this.identity.identity();
    if (!who) {
      void this.router.navigateByUrl('/');
      return;
    }
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

  get who() {
    return this.identity.identity();
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
    const who = this.identity.identity();
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
