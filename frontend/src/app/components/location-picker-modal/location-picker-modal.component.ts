import { Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

export interface PickerOption {
  id: string;
  label: string;
}

@Component({
  selector: 'app-location-picker-modal',
  imports: [FormsModule],
  templateUrl: './location-picker-modal.component.html',
  styleUrl: './location-picker-modal.component.scss',
})
export class LocationPickerModalComponent {
  readonly title = input.required<string>();
  readonly options = input.required<PickerOption[]>();
  readonly loading = input(false);
  readonly emptyMessage = input('Nothing to show yet.');
  readonly addSectionLabel = input('Add a new one');
  readonly allowAdd = input(true);
  readonly errorMessage = input<string | null>(null);
  readonly validating = input(false);

  readonly picked = output<string>();
  readonly dismissed = output<void>();
  readonly errorCleared = output<void>();

  readonly searchQuery = signal('');
  readonly newEntryName = signal('');

  readonly filteredOptions = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const options = this.options();
    if (!query) {
      return options;
    }
    return options.filter((option) => option.label.toLowerCase().includes(query));
  });

  readonly showNoMatches = computed(
    () => !this.loading() && this.options().length > 0 && this.filteredOptions().length === 0,
  );

  onSearchChange(value: string): void {
    this.searchQuery.set(value);
    this.newEntryName.set(value);
    this.errorCleared.emit();
  }

  onNewEntryChange(value: string): void {
    this.newEntryName.set(value);
    this.errorCleared.emit();
  }

  onPick(label: string): void {
    this.picked.emit(label);
  }

  onAddCustom(): void {
    const name = this.newEntryName().trim();
    if (!name) {
      return;
    }
    this.picked.emit(name);
  }

  onDismiss(): void {
    this.dismissed.emit();
  }
}
