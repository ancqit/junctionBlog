import { Component, EventEmitter, Output, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IdentityService } from '../../core/identity.service';

type Step = 'idle' | 'name' | 'number' | 'comment';

interface Line {
  kind: 'sys' | 'in' | 'out' | 'err';
  text: string;
}

@Component({
  selector: 'app-comment-cli',
  imports: [FormsModule],
  templateUrl: './comment-cli.component.html',
  styleUrl: './comment-cli.component.scss',
})
export class CommentCliComponent {
  private readonly identity = inject(IdentityService);
  @Output() readonly comment = new EventEmitter<{
    body: string;
    creatorName: string;
    creatorNumber: string;
    nameTag: string;
  }>();

  command = '';
  private draftName = '';
  private pendingBody = '';
  readonly step = signal<Step>('idle');
  readonly log = signal<Line[]>([
    { kind: 'sys', text: 'comment> enter name and number, then the comment. it is appended to this blog.' },
  ]);

  submit(): void {
    const raw = this.command.trim();
    if (!raw) {
      return;
    }
    this.append('in', raw);
    this.command = '';
    const step = this.step();
    if (step === 'name') {
      this.draftName = raw;
      this.step.set('number');
      this.append('sys', 'mobile number? (blank allowed)');
      return;
    }
    if (step === 'number') {
      try {
        const who = this.identity.enter(this.draftName, raw || null);
        this.append('out', `${who.nameTag} / ${who.userNumber}`);
        if (this.pendingBody) {
          this.emitComment(this.pendingBody);
          return;
        }
        this.step.set('comment');
        this.append('sys', 'comment?');
      } catch (error) {
        this.append('err', error instanceof Error ? error.message : 'enter failed');
        this.step.set('idle');
      }
      return;
    }
    if (step === 'comment') {
      this.emitComment(raw);
      return;
    }
    this.begin(raw);
  }

  prompt(): string {
    switch (this.step()) {
      case 'name':
        return 'name>';
      case 'number':
        return 'number>';
      case 'comment':
        return 'comment>';
      default:
        return 'comment>';
    }
  }

  private begin(raw: string): void {
    if (raw.toLowerCase() === 'help') {
      this.append('out', 'type comment text. if you have no session: name, then number, then comment.');
      return;
    }
    if (!this.identity.identity()) {
      this.pendingBody = raw;
      this.step.set('name');
      this.append('sys', 'name?');
      return;
    }
    this.emitComment(raw);
  }

  private emitComment(body: string): void {
    let who = this.identity.identity();
    if (!who && this.draftName) {
      who = this.identity.enter(this.draftName, null);
    }
    if (!who) {
      this.append('err', 'name required');
      this.step.set('name');
      return;
    }
    const text = body || this.pendingBody;
    this.pendingBody = '';
    if (!text.trim()) {
      this.append('err', 'comment cannot be empty');
      return;
    }
    this.comment.emit({
      body: text.trim(),
      creatorName: who.displayName,
      creatorNumber: who.userNumber,
      nameTag: who.nameTag,
    });
    this.append('out', `appended as ${who.nameTag}`);
    this.step.set('idle');
  }

  private append(kind: Line['kind'], text: string): void {
    this.log.update((lines) => [...lines, { kind, text }]);
  }
}
