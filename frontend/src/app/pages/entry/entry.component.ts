import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { BlogService } from '../../core/blog.service';
import { IdentityService } from '../../core/identity.service';
import { JUNCTION_TODAY, JUNCTION_WEBSITE } from '../../core/api.config';
import { BlogComment, BlogEntry, BlogShopIdentity } from '../../models/blog.models';

type AuthorKind = 'person' | 'shop';

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
  readonly today = JUNCTION_TODAY;
  readonly website = JUNCTION_WEBSITE;

  commentBody = '';
  commentName = this.identity.identity()?.displayName ?? '';
  commentPhone = this.identity.identity()?.phoneNumber?.replace(/^\+91/, '') ?? '';
  shopPhone = this.identity.identity()?.phoneNumber?.replace(/^\+91/, '') ?? '';
  authorKind: AuthorKind = 'person';

  readonly menuOpenId = signal<string | null>(null);
  readonly editingId = signal<string | null>(null);
  readonly editDraft = signal('');
  readonly posting = signal(false);
  readonly verifyingShop = signal(false);
  readonly shopIdentity = signal<BlogShopIdentity | null>(null);
  readonly error = signal('');

  ngOnInit(): void {
    const blogNumber = Number(this.route.snapshot.paramMap.get('number'));
    void this.blog.refresh().then(() => {
      this.entry.set(this.blog.byNumber(blogNumber) ?? null);
    });
    this.entry.set(this.blog.byNumber(blogNumber) ?? null);
  }

  setAuthorKind(kind: AuthorKind): void {
    this.authorKind = kind;
    this.error.set('');
  }

  onShopPhoneChange(): void {
    this.shopIdentity.set(null);
  }

  canManage(comment: BlogComment): boolean {
    const who = this.identity.identity();
    if (
      who &&
      who.userNumber === comment.creatorNumber &&
      who.nameTag.toLowerCase() === comment.nameTag.toLowerCase()
    ) {
      return true;
    }
    const shop = this.shopIdentity();
    return Boolean(
      shop &&
        shop.creator_number === comment.creatorNumber &&
        shop.name_tag.toLowerCase() === comment.nameTag.toLowerCase(),
    );
  }

  toggleMenu(commentId: string, event: Event): void {
    event.stopPropagation();
    this.menuOpenId.update((current) => (current === commentId ? null : commentId));
  }

  startEdit(comment: BlogComment): void {
    this.menuOpenId.set(null);
    this.editingId.set(comment.id);
    this.editDraft.set(comment.body);
  }

  cancelEdit(): void {
    this.editingId.set(null);
    this.editDraft.set('');
  }

  async saveEdit(comment: BlogComment): Promise<void> {
    const current = this.entry();
    const body = this.editDraft().trim();
    if (!current || !body) {
      return;
    }
    const updated = await this.blog.updateComment(current.blogNumber, comment.id, body, {
      creatorNumber: comment.creatorNumber,
      nameTag: comment.nameTag,
    });
    if (updated) {
      this.entry.set(updated);
      this.cancelEdit();
    }
  }

  async deleteComment(comment: BlogComment): Promise<void> {
    const current = this.entry();
    if (!current) {
      return;
    }
    this.menuOpenId.set(null);
    const updated = await this.blog.deleteComment(current.blogNumber, comment.id, {
      creatorNumber: comment.creatorNumber,
      nameTag: comment.nameTag,
    });
    if (updated) {
      this.entry.set(updated);
    }
  }

  async verifyShop(): Promise<void> {
    const phone = this.shopPhone.trim();
    if (!phone) {
      this.error.set('Enter the shop phone number to verify.');
      return;
    }
    this.verifyingShop.set(true);
    this.error.set('');
    try {
      this.shopIdentity.set(await this.blog.verifyShopPhone(phone));
    } catch {
      this.shopIdentity.set(null);
      this.error.set('No shop found for that phone number.');
    } finally {
      this.verifyingShop.set(false);
    }
  }

  async submitComment(): Promise<void> {
    const current = this.entry();
    const body = this.commentBody.trim();
    if (!current || !body) {
      this.error.set('Write a comment first.');
      return;
    }

    let creatorName = '';
    let creatorNumber = '';
    let nameTag = '';
    let shopId: string | null = null;

    if (this.authorKind === 'shop') {
      const shop = this.shopIdentity();
      if (!shop) {
        this.error.set('Verify a shop phone before commenting as a shop.');
        return;
      }
      creatorName = shop.creator_name;
      creatorNumber = shop.creator_number;
      nameTag = shop.name_tag;
      shopId = shop.shop_id;
    } else {
      const name = this.commentName.trim();
      if (!name) {
        this.error.set('Enter a name to comment.');
        return;
      }
      const who = this.identity.enter(name, this.commentPhone.trim() || null);
      creatorName = who.displayName;
      creatorNumber = who.userNumber;
      nameTag = who.nameTag;
    }

    this.posting.set(true);
    this.error.set('');
    try {
      const updated = await this.blog.addComment(current.blogNumber, {
        body,
        creatorName,
        creatorNumber,
        nameTag,
        authorKind: this.authorKind,
        shopId,
      });
      if (updated) {
        this.entry.set(updated);
        this.commentBody = '';
      }
    } finally {
      this.posting.set(false);
    }
  }
}
