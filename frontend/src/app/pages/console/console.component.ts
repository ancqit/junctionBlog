import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { BlogService } from '../../core/blog.service';
import { IdentityService } from '../../core/identity.service';
import { JUNCTION_TODAY, JUNCTION_WEBSITE } from '../../core/api.config';
import { BlogEntry } from '../../models/blog.models';

type PromptStep = 'idle' | 'name' | 'number' | 'junction' | 'body' | 'tags';

interface LogLine {
  kind: 'sys' | 'in' | 'out' | 'err';
  text: string;
}

@Component({
  selector: 'app-console',
  imports: [FormsModule, RouterLink],
  templateUrl: './console.component.html',
  styleUrl: './console.component.scss',
})
export class ConsoleComponent implements OnInit {
  private readonly identity = inject(IdentityService);
  private readonly blog = inject(BlogService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  command = '';
  draftName = '';
  draftPhone = '';
  draftJunction = '';
  draftBody = '';
  draftTags = '';

  readonly step = signal<PromptStep>('idle');
  readonly log = signal<LogLine[]>([
    { kind: 'sys', text: 'junction.blog // support for junction.today and junction.website' },
    { kind: 'sys', text: 'this blog is always related to a junction. type help.' },
  ]);
  readonly results = signal<BlogEntry[]>([]);

  ngOnInit(): void {
    void this.blog.refresh().then(() => {
      const blogNo = this.route.snapshot.queryParamMap.get('blog');
      if (blogNo) {
        this.results.set(this.blog.search(blogNo));
        this.append('sys', `opened from junction share link, blog ${blogNo}`);
      }
    });
    const who = this.identity.identity();
    if (who) {
      this.append('out', `session ${who.nameTag}  user ${who.userNumber}`);
    }
  }

  get identityLine(): string {
    const who = this.identity.identity();
    return who ? `${who.nameTag} / ${who.userNumber}` : 'guest';
  }

  get storeLine(): string {
    return this.blog.usingLocalStore() ? 'local-store' : 'junctionBack';
  }

  submit(): void {
    const raw = this.command.trim();
    if (!raw) {
      return;
    }
    this.append('in', raw);
    this.command = '';
    const step = this.step();
    if (step !== 'idle') {
      this.handlePrompt(raw);
      return;
    }
    this.handleCommand(raw);
  }

  private handleCommand(raw: string): void {
    const [verb, ...rest] = raw.split(/\s+/);
    const arg = rest.join(' ').trim();
    switch (verb.toLowerCase()) {
      case 'help':
        this.append(
          'out',
          'enter | post | find <blog# or text> | tag <nametag> | profile | share <blog#> | open <blog#> | login | who | clear',
        );
        break;
      case 'enter':
        this.beginEnter(arg);
        break;
      case 'post':
        this.beginPost();
        break;
      case 'find':
        this.results.set(this.blog.search(arg));
        this.append('out', `${this.results().length} hit(s). search is blog number first, nametag refines.`);
        break;
      case 'tag':
        this.results.set(this.blog.search('', arg));
        this.append('out', `${this.results().length} tagged as ${arg || '*'}`);
        break;
      case 'who':
        this.append('out', this.identityLine);
        break;
      case 'clear':
        this.log.set([]);
        this.results.set([]);
        break;
      case 'share':
        this.share(Number(arg.replace('#', '')));
        break;
      case 'profile':
        void this.router.navigateByUrl('/profile');
        break;
      case 'login':
        void this.router.navigateByUrl('/login');
        break;
      case 'open':
        void this.router.navigate(['/b', arg.replace('#', '')]);
        break;
      default:
        if (/^\d+$/.test(verb)) {
          this.results.set(this.blog.search(verb));
          this.append('out', `lookup blog ${verb}`);
          break;
        }
        this.append('err', `unknown verb ${verb}. type help.`);
    }
  }

  private beginEnter(arg: string): void {
    if (arg) {
      const [name, phone] = this.splitNamePhone(arg);
      this.finishEnter(name, phone);
      return;
    }
    this.step.set('name');
    this.append('sys', 'name?');
  }

  private beginPost(): void {
    if (!this.identity.identity()) {
      this.step.set('name');
      this.append('sys', 'post without profile is allowed. name?');
      this.pendingPost = true;
      return;
    }
    this.step.set('junction');
    this.append('sys', 'junction? (required — this blog is for a junction)');
  }

  private pendingPost = false;

  private handlePrompt(raw: string): void {
    const step = this.step();
    if (step === 'name') {
      this.draftName = raw;
      this.step.set('number');
      this.append('sys', 'mobile number? (blank allowed)');
      return;
    }
    if (step === 'number') {
      this.draftPhone = raw;
      this.finishEnter(this.draftName, this.draftPhone || null);
      if (this.pendingPost) {
        this.pendingPost = false;
        this.step.set('junction');
        this.append('sys', 'junction? (required — this blog is for a junction)');
      }
      return;
    }
    if (step === 'junction') {
      if (!raw.trim()) {
        this.append('err', 'a junction is required.');
        return;
      }
      this.draftJunction = raw.trim();
      this.step.set('body');
      this.append('sys', 'input? (complaint / note / action)');
      return;
    }
    if (step === 'body') {
      if (!raw.trim()) {
        this.append('err', 'input cannot be empty.');
        return;
      }
      this.draftBody = raw.trim();
      this.step.set('tags');
      this.append('sys', 'nametags / keywords? (comma separated, blank ok)');
      return;
    }
    if (step === 'tags') {
      this.draftTags = raw;
      void this.commitPost();
    }
  }

  private finishEnter(name: string, phone: string | null): void {
    try {
      const who = this.identity.enter(name, phone);
      this.step.set('idle');
      this.append('out', `entered ${who.displayName}  number ${who.userNumber}  tag ${who.nameTag}`);
    } catch (error) {
      this.append('err', error instanceof Error ? error.message : 'enter failed');
      this.step.set('idle');
    }
  }

  private async commitPost(): Promise<void> {
    const who = this.identity.identity();
    if (!who) {
      this.append('err', 'enter first.');
      this.step.set('idle');
      return;
    }
    const tags = this.draftTags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
    tags.unshift(who.nameTag);
    const entry = await this.blog.createEntry({
      junction: this.draftJunction,
      body: this.draftBody,
      creatorName: who.displayName,
      creatorNumber: who.userNumber,
      nameTag: who.nameTag,
      tags: [...new Set(tags)],
    });
    this.step.set('idle');
    this.results.set([entry, ...this.results()]);
    this.append(
      'out',
      `logged blog ${entry.blogNumber} for junction ${entry.junction} as ${entry.nameTag}`,
    );
    this.append(
      'sys',
      `share  ${JUNCTION_TODAY}?blog=${entry.blogNumber}  ${JUNCTION_WEBSITE}?blog=${entry.blogNumber}`,
    );
  }

  private share(blogNumber: number): void {
    if (!blogNumber) {
      this.append('err', 'share <blog#>');
      return;
    }
    this.append('out', `${JUNCTION_TODAY}?blog=${blogNumber}`);
    this.append('out', `${JUNCTION_WEBSITE}?blog=${blogNumber}`);
    this.append('sys', 'those sites can open the number to edit / add content.');
  }

  private splitNamePhone(arg: string): [string, string | null] {
    const match = arg.match(/^(.*?)(?:\s+)(\+?\d{10,15})$/);
    if (match) {
      return [match[1].trim(), match[2]];
    }
    return [arg.trim(), null];
  }

  private append(kind: LogLine['kind'], text: string): void {
    this.log.update((lines) => [...lines, { kind, text }]);
  }

  promptPrefix(): string {
    switch (this.step()) {
      case 'name':
        return 'name>';
      case 'number':
        return 'number>';
      case 'junction':
        return 'junction>';
      case 'body':
        return 'input>';
      case 'tags':
        return 'tags>';
      default:
        return `${this.identityLine}>`;
    }
  }
}
