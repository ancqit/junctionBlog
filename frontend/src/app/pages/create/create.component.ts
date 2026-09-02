import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { BlogService } from '../../core/blog.service';
import { IdentityService } from '../../core/identity.service';

@Component({
  selector: 'app-create',
  imports: [FormsModule, RouterLink],
  templateUrl: './create.component.html',
  styleUrl: './create.component.scss',
})
export class CreateComponent {
  private readonly blog = inject(BlogService);
  private readonly identity = inject(IdentityService);
  private readonly router = inject(Router);

  junction = '';
  body = '';
  displayName = this.identity.identity()?.displayName ?? '';
  phoneNumber = this.identity.identity()?.phoneNumber?.replace(/^\+91/, '') ?? '';
  tags = '';
  readonly error = signal('');
  readonly saving = signal(false);

  async submit(): Promise<void> {
    this.error.set('');
    const junction = this.junction.trim();
    const body = this.body.trim();
    const name = this.displayName.trim();
    if (!junction) {
      this.error.set('This blog must be for a junction.');
      return;
    }
    if (!body) {
      this.error.set('Write the complaint or note.');
      return;
    }
    if (!name) {
      this.error.set('A name is enough if you skip a profile.');
      return;
    }
    const who = this.identity.enter(name, this.phoneNumber.trim() || null);
    const tags = this.tags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
    tags.unshift(who.nameTag);
    this.saving.set(true);
    try {
      const entry = await this.blog.createEntry({
        junction,
        body,
        creatorName: who.displayName,
        creatorNumber: who.userNumber,
        nameTag: who.nameTag,
        tags: [...new Set(tags)],
      });
      void this.router.navigate(['/b', entry.blogNumber]);
    } finally {
      this.saving.set(false);
    }
  }
}
