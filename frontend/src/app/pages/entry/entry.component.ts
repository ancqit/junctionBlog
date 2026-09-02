import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CommentCliComponent } from '../../components/comment-cli/comment-cli.component';
import { BlogService } from '../../core/blog.service';
import { JUNCTION_TODAY, JUNCTION_WEBSITE } from '../../core/api.config';
import { BlogEntry } from '../../models/blog.models';

@Component({
  selector: 'app-entry',
  imports: [RouterLink, CommentCliComponent],
  templateUrl: './entry.component.html',
  styleUrl: './entry.component.scss',
})
export class EntryComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly blog = inject(BlogService);

  readonly entry = signal<BlogEntry | null>(null);
  readonly today = JUNCTION_TODAY;
  readonly website = JUNCTION_WEBSITE;

  ngOnInit(): void {
    const blogNumber = Number(this.route.snapshot.paramMap.get('number'));
    void this.blog.refresh().then(() => {
      this.entry.set(this.blog.byNumber(blogNumber) ?? null);
    });
    this.entry.set(this.blog.byNumber(blogNumber) ?? null);
  }

  async onComment(payload: {
    body: string;
    creatorName: string;
    creatorNumber: string;
    nameTag: string;
  }): Promise<void> {
    const current = this.entry();
    if (!current) {
      return;
    }
    const updated = await this.blog.addComment(current.blogNumber, payload);
    if (updated) {
      this.entry.set(updated);
    }
  }
}
