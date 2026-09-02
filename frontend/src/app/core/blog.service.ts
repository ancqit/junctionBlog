import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { BlogEntry, BlogProfile } from '../models/blog.models';
import { API_BASE_URL } from './api.config';

const ENTRIES_KEY = 'jblog.entries';
const PROFILES_KEY = 'jblog.profiles';
const BLOG_SEQ_KEY = 'jblog.blogSeq';

@Injectable({ providedIn: 'root' })
export class BlogService {
  private readonly http = inject(HttpClient);
  readonly entries = signal<BlogEntry[]>(this.readEntries());
  readonly profiles = signal<BlogProfile[]>(this.readProfiles());
  readonly usingLocalStore = signal(true);

  async refresh(): Promise<void> {
    try {
      const remote = await firstValueFrom(
        this.http.get<BlogEntry[]>(`${API_BASE_URL}/blog/entries`),
      );
      if (Array.isArray(remote)) {
        this.entries.set(remote);
        this.writeEntries(remote);
        this.usingLocalStore.set(false);
      }
    } catch {
      this.usingLocalStore.set(true);
    }
    try {
      const remoteProfiles = await firstValueFrom(
        this.http.get<BlogProfile[]>(`${API_BASE_URL}/blog/profiles`),
      );
      if (Array.isArray(remoteProfiles)) {
        this.profiles.set(remoteProfiles);
        this.writeProfiles(remoteProfiles);
      }
    } catch {
      /* local profiles remain */
    }
  }

  search(query: string, nameTag?: string): BlogEntry[] {
    const q = query.trim();
    const tag = (nameTag ?? '').trim().toLowerCase();
    return this.entries()
      .filter((entry) => {
        const numberHit = !q || String(entry.blogNumber).includes(q.replace(/^#/, ''));
        const textHit =
          !q ||
          entry.junction.toLowerCase().includes(q.toLowerCase()) ||
          entry.body.toLowerCase().includes(q.toLowerCase()) ||
          entry.tags.some((item) => item.toLowerCase().includes(q.toLowerCase())) ||
          entry.nameTag.toLowerCase().includes(q.toLowerCase());
        const tagHit = !tag || entry.nameTag.toLowerCase().includes(tag) || entry.creatorName.toLowerCase().includes(tag);
        return (numberHit || textHit) && tagHit;
      })
      .sort((a, b) => b.blogNumber - a.blogNumber);
  }

  byNumber(blogNumber: number): BlogEntry | undefined {
    return this.entries().find((entry) => entry.blogNumber === blogNumber);
  }

  profileFor(userNumber: string): BlogProfile | undefined {
    return this.profiles().find((profile) => profile.userNumber === userNumber);
  }

  async createEntry(input: {
    junction: string;
    body: string;
    creatorName: string;
    creatorNumber: string;
    nameTag: string;
    tags: string[];
  }): Promise<BlogEntry> {
    const payload: Omit<BlogEntry, 'id' | 'createdAt' | 'updatedAt' | 'blogNumber'> & {
      blogNumber?: number;
    } = { ...input };
    try {
      const created = await firstValueFrom(
        this.http.post<BlogEntry>(`${API_BASE_URL}/blog/entries`, payload),
      );
      this.upsertEntry(created);
      this.usingLocalStore.set(false);
      return created;
    } catch {
      const now = new Date().toISOString();
      const local: BlogEntry = {
        id: crypto.randomUUID(),
        blogNumber: this.nextBlogNumber(),
        junction: input.junction.trim(),
        body: input.body.trim(),
        creatorName: input.creatorName.trim(),
        creatorNumber: input.creatorNumber,
        nameTag: input.nameTag,
        tags: input.tags.map((tag) => tag.trim()).filter(Boolean),
        createdAt: now,
        updatedAt: now,
      };
      this.upsertEntry(local);
      this.usingLocalStore.set(true);
      return local;
    }
  }

  async updateEntry(blogNumber: number, body: string): Promise<BlogEntry | null> {
    const current = this.byNumber(blogNumber);
    if (!current) {
      return null;
    }
    try {
      const updated = await firstValueFrom(
        this.http.patch<BlogEntry>(`${API_BASE_URL}/blog/entries/${blogNumber}`, { body }),
      );
      this.upsertEntry(updated);
      return updated;
    } catch {
      const updated: BlogEntry = {
        ...current,
        body: body.trim(),
        updatedAt: new Date().toISOString(),
      };
      this.upsertEntry(updated);
      this.usingLocalStore.set(true);
      return updated;
    }
  }

  async saveProfile(profile: BlogProfile): Promise<BlogProfile> {
    try {
      const saved = await firstValueFrom(
        this.http.put<BlogProfile>(`${API_BASE_URL}/blog/profiles/${profile.userNumber}`, profile),
      );
      this.upsertProfile(saved);
      return saved;
    } catch {
      const saved = { ...profile, updatedAt: new Date().toISOString() };
      this.upsertProfile(saved);
      this.usingLocalStore.set(true);
      return saved;
    }
  }

  private upsertEntry(entry: BlogEntry): void {
    const next = [entry, ...this.entries().filter((item) => item.blogNumber !== entry.blogNumber)];
    this.entries.set(next);
    this.writeEntries(next);
  }

  private upsertProfile(profile: BlogProfile): void {
    const next = [profile, ...this.profiles().filter((item) => item.userNumber !== profile.userNumber)];
    this.profiles.set(next);
    this.writeProfiles(next);
  }

  private nextBlogNumber(): number {
    const current = Number(localStorage.getItem(BLOG_SEQ_KEY) ?? '2000');
    const next = current + 1;
    localStorage.setItem(BLOG_SEQ_KEY, String(next));
    return next;
  }

  private readEntries(): BlogEntry[] {
    try {
      const raw = localStorage.getItem(ENTRIES_KEY);
      return raw ? (JSON.parse(raw) as BlogEntry[]) : [];
    } catch {
      return [];
    }
  }

  private writeEntries(entries: BlogEntry[]): void {
    localStorage.setItem(ENTRIES_KEY, JSON.stringify(entries));
  }

  private readProfiles(): BlogProfile[] {
    try {
      const raw = localStorage.getItem(PROFILES_KEY);
      return raw ? (JSON.parse(raw) as BlogProfile[]) : [];
    } catch {
      return [];
    }
  }

  private writeProfiles(profiles: BlogProfile[]): void {
    localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
  }
}
