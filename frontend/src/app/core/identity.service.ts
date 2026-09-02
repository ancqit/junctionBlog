import { Injectable, computed, signal } from '@angular/core';
import { BlogIdentity } from '../models/blog.models';
import { nameTag } from '../lib/routine';

const IDENTITY_KEY = 'jblog.identity';
const USER_SEQ_KEY = 'jblog.userSeq';

@Injectable({ providedIn: 'root' })
export class IdentityService {
  private readonly identitySignal = signal<BlogIdentity | null>(this.readIdentity());

  readonly identity = this.identitySignal.asReadonly();
  readonly isEntered = computed(() => this.identitySignal() !== null);

  enter(displayName: string, phoneNumber: string | null): BlogIdentity {
    const name = displayName.trim();
    if (!name) {
      throw new Error('name required');
    }
    const phone = this.normalizePhone(phoneNumber);
    const existing = this.identitySignal();
    const userNumber = existing?.userNumber ?? this.nextUserNumber(phone);
    const identity: BlogIdentity = {
      userNumber,
      displayName: name,
      phoneNumber: phone,
      nameTag: nameTag(name, userNumber),
    };
    localStorage.setItem(IDENTITY_KEY, JSON.stringify(identity));
    this.identitySignal.set(identity);
    return identity;
  }

  clear(): void {
    localStorage.removeItem(IDENTITY_KEY);
    this.identitySignal.set(null);
  }

  private nextUserNumber(phone: string | null): string {
    if (phone && phone.length >= 4) {
      const suffix = phone.slice(-4);
      return suffix;
    }
    const current = Number(localStorage.getItem(USER_SEQ_KEY) ?? '1000');
    const next = current + 1;
    localStorage.setItem(USER_SEQ_KEY, String(next));
    return String(next);
  }

  private normalizePhone(phoneNumber: string | null): string | null {
    if (!phoneNumber) {
      return null;
    }
    const digits = phoneNumber.replace(/\D/g, '');
    if (!digits) {
      return null;
    }
    if (digits.length === 10) {
      return `+91${digits}`;
    }
    if (digits.length === 12 && digits.startsWith('91')) {
      return `+${digits}`;
    }
    if (phoneNumber.startsWith('+') && digits.length >= 8) {
      return `+${digits}`;
    }
    return `+${digits}`;
  }

  private readIdentity(): BlogIdentity | null {
    try {
      const raw = localStorage.getItem(IDENTITY_KEY);
      return raw ? (JSON.parse(raw) as BlogIdentity) : null;
    } catch {
      return null;
    }
  }
}
