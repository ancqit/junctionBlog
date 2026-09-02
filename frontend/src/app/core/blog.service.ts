import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { BlogComment, BlogEntry, BlogProfile, BlogShopIdentity } from '../models/blog.models';
import { API_BASE_URL } from './api.config';

const ENTRIES_KEY = 'jblog.entries';
const PROFILES_KEY = 'jblog.profiles';
const BLOG_SEQ_KEY = 'jblog.blogSeq';

@Injectable({ providedIn: 'root' })
export class BlogService {
  private readonly http = inject(HttpClient);
  readonly entries = signal<BlogEntry[]>(this.normalizeAll(this.readEntries()));
  readonly profiles = signal<BlogProfile[]>(this.readProfiles());
  readonly usingLocalStore = signal(true);
  readonly lastError = signal('');

  async refresh(): Promise<void> {
    try {
      const remote = await firstValueFrom(
        this.http.get<BlogEntry[]>(`${API_BASE_URL}/blog/entries`),
      );
      if (Array.isArray(remote)) {
        const entries = this.normalizeAll(remote);
        this.entries.set(entries);
        this.writeEntries(entries);
        this.usingLocalStore.set(false);
        this.lastError.set('');
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
          (entry.city ?? '').toLowerCase().includes(q.toLowerCase()) ||
          (entry.locality ?? '').toLowerCase().includes(q.toLowerCase()) ||
          entry.body.toLowerCase().includes(q.toLowerCase()) ||
          entry.tags.some((item) => item.toLowerCase().includes(q.toLowerCase())) ||
          entry.nameTag.toLowerCase().includes(q.toLowerCase());
        const tagHit =
          !tag ||
          entry.nameTag.toLowerCase().includes(tag) ||
          entry.creatorName.toLowerCase().includes(tag);
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
    city?: string;
    locality?: string;
    body: string;
    creatorName: string;
    creatorNumber: string;
    nameTag: string;
    tags: string[];
    authorKind?: 'person' | 'shop';
    shopId?: string | null;
  }): Promise<BlogEntry> {
    try {
      const created = await firstValueFrom(
        this.http.post<BlogEntry>(`${API_BASE_URL}/blog/entries`, input),
      );
      const entry = this.normalize(created);
      this.upsertEntry(entry);
      this.usingLocalStore.set(false);
      this.lastError.set('');
      return entry;
    } catch (error) {
      this.lastError.set(this.messageOf(error));
      const now = new Date().toISOString();
      const local = this.normalize({
        id: crypto.randomUUID(),
        blogNumber: this.nextBlogNumber(),
        junction: input.junction.trim(),
        city: input.city?.trim(),
        locality: input.locality?.trim(),
        body: input.body.trim(),
        creatorName: input.creatorName.trim(),
        creatorNumber: input.creatorNumber,
        nameTag: input.nameTag,
        tags: input.tags.map((tag) => tag.trim()).filter(Boolean),
        authorKind: input.authorKind ?? 'person',
        shopId: input.shopId ?? null,
        comments: [],
        createdAt: now,
        updatedAt: now,
      });
      this.upsertEntry(local);
      this.usingLocalStore.set(true);
      return local;
    }
  }

  async addComment(
    blogNumber: number,
    input: {
      body: string;
      creatorName: string;
      creatorNumber: string;
      nameTag: string;
      authorKind?: 'person' | 'shop';
      shopId?: string | null;
    },
  ): Promise<BlogEntry | null> {
    const current = this.byNumber(blogNumber);
    if (!current) {
      return null;
    }
    try {
      const updated = await firstValueFrom(
        this.http.post<BlogEntry>(`${API_BASE_URL}/blog/entries/${blogNumber}/comments`, input),
      );
      const entry = this.normalize(updated);
      this.upsertEntry(entry);
      this.usingLocalStore.set(false);
      this.lastError.set('');
      return entry;
    } catch (error) {
      this.lastError.set(this.messageOf(error));
      const comment: BlogComment = {
        id: crypto.randomUUID(),
        body: input.body.trim(),
        creatorName: input.creatorName.trim(),
        creatorNumber: input.creatorNumber,
        nameTag: input.nameTag,
        createdAt: new Date().toISOString(),
        authorKind: input.authorKind ?? 'person',
        shopId: input.shopId ?? null,
      };
      const entry = this.normalize({
        ...current,
        comments: [...current.comments, comment],
        updatedAt: new Date().toISOString(),
      });
      this.upsertEntry(entry);
      this.usingLocalStore.set(true);
      return entry;
    }
  }

  async updateComment(
    blogNumber: number,
    commentId: string,
    body: string,
    owner: { creatorNumber: string; nameTag: string },
  ): Promise<BlogEntry | null> {
    const current = this.byNumber(blogNumber);
    if (!current) {
      return null;
    }
    try {
      const updated = await firstValueFrom(
        this.http.patch<BlogEntry>(`${API_BASE_URL}/blog/entries/${blogNumber}/comments/${commentId}`, {
          body,
          ...owner,
        }),
      );
      const entry = this.normalize(updated);
      this.upsertEntry(entry);
      this.usingLocalStore.set(false);
      return entry;
    } catch (error) {
      this.lastError.set(this.messageOf(error));
      const comments = current.comments.map((comment) =>
        comment.id === commentId &&
        comment.creatorNumber === owner.creatorNumber &&
        comment.nameTag.toLowerCase() === owner.nameTag.toLowerCase()
          ? { ...comment, body: body.trim() }
          : comment,
      );
      const entry = this.normalize({
        ...current,
        comments,
        updatedAt: new Date().toISOString(),
      });
      this.upsertEntry(entry);
      this.usingLocalStore.set(true);
      return entry;
    }
  }

  async deleteComment(
    blogNumber: number,
    commentId: string,
    owner: { creatorNumber: string; nameTag: string },
  ): Promise<BlogEntry | null> {
    const current = this.byNumber(blogNumber);
    if (!current) {
      return null;
    }
    try {
      const updated = await firstValueFrom(
        this.http.delete<BlogEntry>(`${API_BASE_URL}/blog/entries/${blogNumber}/comments/${commentId}`, {
          body: owner,
        }),
      );
      const entry = this.normalize(updated);
      this.upsertEntry(entry);
      this.usingLocalStore.set(false);
      return entry;
    } catch (error) {
      this.lastError.set(this.messageOf(error));
      const comments = current.comments.filter(
        (comment) =>
          !(
            comment.id === commentId &&
            comment.creatorNumber === owner.creatorNumber &&
            comment.nameTag.toLowerCase() === owner.nameTag.toLowerCase()
          ),
      );
      const entry = this.normalize({
        ...current,
        comments,
        updatedAt: new Date().toISOString(),
      });
      this.upsertEntry(entry);
      this.usingLocalStore.set(true);
      return entry;
    }
  }

  async verifyShopPhone(phoneNumber: string): Promise<BlogShopIdentity> {
    return firstValueFrom(
      this.http.post<BlogShopIdentity>(`${API_BASE_URL}/blog/verify-shop-phone`, {
        phone_number: phoneNumber,
      }),
    );
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
      const entry = this.normalize(updated);
      this.upsertEntry(entry);
      return entry;
    } catch {
      const updated = this.normalize({
        ...current,
        body: body.trim(),
        updatedAt: new Date().toISOString(),
      });
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

  private normalize(entry: BlogEntry): BlogEntry {
    return { ...entry, comments: entry.comments ?? [] };
  }

  private normalizeAll(entries: BlogEntry[]): BlogEntry[] {
    return entries.map((entry) => this.normalize(entry));
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

  private messageOf(error: unknown): string {
    if (error && typeof error === 'object' && 'message' in error) {
      return String((error as { message: string }).message);
    }
    return 'junctionBack /blog is not available yet';
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
