import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { BlogService } from '../../core/blog.service';
import { BlogEntry } from '../../models/blog.models';

@Component({
  selector: 'app-feed',
  imports: [FormsModule, RouterLink],
  templateUrl: './feed.component.html',
  styleUrl: './feed.component.scss',
})
export class FeedComponent implements OnInit {
  private readonly blog = inject(BlogService);
  private readonly route = inject(ActivatedRoute);

  query = '';
  readonly blogs = signal<BlogEntry[]>([]);

  ngOnInit(): void {
    const shared = this.route.snapshot.queryParamMap.get('blog');
    if (shared) {
      this.query = shared;
    }
    void this.blog.refresh().then(() => this.applySearch());
    this.applySearch();
  }

  get usingLocal(): boolean {
    return this.blog.usingLocalStore();
  }

  applySearch(): void {
    this.blogs.set(this.blog.search(this.query));
  }
}
