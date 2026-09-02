import { Component, computed, input, output, signal } from '@angular/core';
import { BLOG_PIN_LENGTH } from '../../core/auth.models';

@Component({
  selector: 'app-character-map-lock',
  templateUrl: './character-map-lock.component.html',
  styleUrl: './character-map-lock.component.scss',
})
export class CharacterMapLockComponent {
  readonly title = input('Choose 4 characters');
  readonly subtitle = input('Tap the character map to build your PIN.');
  readonly characters = input.required<string[]>();
  readonly confirmLabel = input('Continue');
  readonly dismissible = input(true);

  readonly completed = output<string>();
  readonly dismissed = output<void>();

  readonly selected = signal<string[]>([]);
  readonly pinLength = BLOG_PIN_LENGTH;

  readonly slots = computed(() => {
    const picked = this.selected();
    return Array.from({ length: this.pinLength }, (_, i) => picked[i] ?? '');
  });

  readonly canSubmit = computed(() => this.selected().length === this.pinLength);

  pick(ch: string): void {
    if (this.selected().length >= this.pinLength) {
      return;
    }
    this.selected.update((rows) => [...rows, ch]);
  }

  backspace(): void {
    this.selected.update((rows) => rows.slice(0, -1));
  }

  clear(): void {
    this.selected.set([]);
  }

  submit(): void {
    if (!this.canSubmit()) {
      return;
    }
    this.completed.emit(this.selected().join(''));
  }

  dismiss(): void {
    if (this.dismissible()) {
      this.dismissed.emit();
    }
  }
}
