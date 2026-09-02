import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { BlogService } from '../../core/blog.service';
import { IdentityService } from '../../core/identity.service';
import { JUNCTION_TODAY, JUNCTION_WEBSITE } from '../../core/api.config';
import { BlogEntry } from '../../models/blog.models';

@Component({
  selector: 'app-entry',
  imports: [FormsModule, RouterLink],
  templateUrl: './entry.component.html',
  styleUrl: './entry.component.scss',
})
export class EntryComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly blog = inject(BlogService);
  private readonly identity = inject(IdentityService);

  readonly entry = signal<BlogEntry | null>(null);
  readonly message = signal('');
  body = '';

  readonly today = JUNCTION_TODAY;
  readonly website = JUNCTION_WEBSITE;

  ngOnInit(): void {
    const raw = this.route.snapshot.paramMap.get('number');
    const blogNumber = Number(raw);
    const found = this.blog.byNumber(blogNumber) ?? null;
    this.entry.set(found);
    this.body = found?.body ?? '';
  }

  get canEdit(): boolean {
    const who = this.identity.identity();
    const entry = this.entry();
    return Boolean(who && entry && who.userNumber === entry.creatorNumber);
  }

  async save(): Promise<void> {
    const entry = this.entry();
    if (!entry) {
      return;
    }
    const updated = await this.blog.updateEntry(entry.blogNumber, this.body);
    if (updated) {
      this.entry.set(updated);
      this.message.set('updated. junction.today / junction.website can deep-link this number to add content.');
    }
  }
}
