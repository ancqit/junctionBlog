import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HourBlock } from '../../models/blog.models';
import { formatHour, normalizeRange, occupiedHours } from '../../lib/routine';

@Component({
  selector: 'app-hour-dial',
  imports: [FormsModule],
  templateUrl: './hour-dial.component.html',
  styleUrl: './hour-dial.component.scss',
})
export class HourDialComponent {
  @Input({ required: true }) blocks: HourBlock[] = [];
  @Input() startHour = 9;
  @Input() endHour = 12;
  @Output() readonly rangeChange = new EventEmitter<{ startHour: number; endHour: number }>();

  readonly hours = Array.from({ length: 24 }, (_, hour) => hour);

  taken(hour: number): boolean {
    return occupiedHours(this.blocks).has(hour);
  }

  selectStart(hour: number): void {
    this.startHour = hour;
    if (this.endHour <= this.startHour) {
      this.endHour = Math.min(24, this.startHour + 1);
    }
    this.emitRange();
  }

  selectEnd(hour: number): void {
    this.endHour = hour === 0 && this.startHour > 0 ? 24 : Math.max(hour, this.startHour + 1);
    this.emitRange();
  }

  inSelection(hour: number): boolean {
    const { start, end } = normalizeRange(this.startHour, this.endHour);
    return hour >= start && hour < end;
  }

  label(hour: number): string {
    return formatHour(hour);
  }

  x(hour: number, radius: number): number {
    return 110 + radius * Math.sin((hour / 24) * Math.PI * 2);
  }

  y(hour: number, radius: number): number {
    return 110 - radius * Math.cos((hour / 24) * Math.PI * 2);
  }

  private emitRange(): void {
    const { start, end } = normalizeRange(this.startHour, this.endHour);
    this.rangeChange.emit({ startHour: start, endHour: end });
  }
}
