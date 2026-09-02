import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  LocationPickerModalComponent,
  PickerOption,
} from '../../components/location-picker-modal/location-picker-modal.component';
import { BlogService } from '../../core/blog.service';
import { IdentityService } from '../../core/identity.service';
import { LocationsApi } from '../../core/locations.api';
import { SessionService } from '../../core/session.service';

type ActivePicker = 'city' | 'locality' | null;

@Component({
  selector: 'app-create',
  imports: [FormsModule, RouterLink, LocationPickerModalComponent],
  templateUrl: './create.component.html',
  styleUrl: './create.component.scss',
})
export class CreateComponent implements OnInit {
  private readonly blog = inject(BlogService);
  private readonly identity = inject(IdentityService);
  private readonly router = inject(Router);
  private readonly locations = inject(LocationsApi);
  private readonly session = inject(SessionService);

  body = '';
  displayName = this.identity.identity()?.displayName ?? '';
  phoneNumber = this.identity.identity()?.phoneNumber?.replace(/^\+91/, '') ?? '';
  tags = '';

  cities: string[] = [];
  localities: string[] = [];
  selectedCity = '';
  selectedLocality = '';

  readonly activePicker = signal<ActivePicker>(null);
  readonly citiesLoading = signal(false);
  readonly localitiesLoading = signal(false);
  readonly addingJunction = signal(false);
  readonly pickerError = signal<string | null>(null);
  readonly error = signal('');
  readonly saving = signal(false);

  ngOnInit(): void {
    this.loadCities();
  }

  get cityOptions(): PickerOption[] {
    return this.cities.map((name) => ({ id: name, label: name }));
  }

  get localityOptions(): PickerOption[] {
    return this.localities.map((name) => ({ id: name, label: name }));
  }

  get junctionLabel(): string {
    if (this.selectedCity && this.selectedLocality) {
      return `${this.selectedLocality}, ${this.selectedCity}`;
    }
    return this.selectedCity;
  }

  openCityPicker(): void {
    this.pickerError.set(null);
    this.activePicker.set('city');
    if (!this.cities.length) {
      this.loadCities();
    }
  }

  openLocalityPicker(): void {
    if (!this.selectedCity || this.localitiesLoading()) {
      return;
    }
    this.pickerError.set(null);
    this.activePicker.set('locality');
  }

  closePicker(): void {
    this.activePicker.set(null);
    this.pickerError.set(null);
    this.addingJunction.set(false);
  }

  onCityPicked(name: string): void {
    const trimmed = name.trim();
    if (!trimmed) {
      return;
    }
    const known = this.cities.find((city) => city.toLowerCase() === trimmed.toLowerCase());
    if (known) {
      this.applyCity(known);
      return;
    }
    this.applyCity(trimmed);
  }

  onLocalityPicked(name: string): void {
    const trimmed = name.trim();
    if (!this.selectedCity || !trimmed) {
      return;
    }
    const known = this.localities.find((item) => item.toLowerCase() === trimmed.toLowerCase());
    if (known) {
      this.selectedLocality = known;
      this.closePicker();
      return;
    }
    this.addingJunction.set(true);
    this.pickerError.set(null);
    this.locations.addJunction(this.selectedCity, trimmed).subscribe({
      next: (response) => {
        this.selectedCity = response.city;
        this.selectedLocality = response.locality;
        if (!this.localities.includes(response.locality)) {
          this.localities = [...this.localities, response.locality].sort();
        }
        this.addingJunction.set(false);
        this.closePicker();
      },
      error: () => {
        this.addingJunction.set(false);
        this.pickerError.set(
          'If the geocoding function fails, please enter a real locality or a prominent locality.',
        );
      },
    });
  }

  async submit(): Promise<void> {
    this.error.set('');
    if (!this.selectedCity || !this.selectedLocality) {
      this.error.set('Pick a city and locality. This blog is for a junction.');
      return;
    }
    const body = this.body.trim();
    const name = this.displayName.trim();
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
    tags.unshift(who.nameTag, this.selectedCity, this.selectedLocality);
    this.saving.set(true);
    try {
      const entry = await this.blog.createEntry({
        junction: this.junctionLabel,
        city: this.selectedCity,
        locality: this.selectedLocality,
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

  private loadCities(): void {
    this.citiesLoading.set(true);
    this.session.ensureSession().subscribe({
      next: () => {
        this.locations.cities().subscribe((cities) => {
          this.cities = cities;
          this.citiesLoading.set(false);
        });
      },
      error: () => {
        this.citiesLoading.set(false);
        this.error.set('Could not start a junction.today session to load cities.');
      },
    });
  }

  private applyCity(city: string): void {
    this.selectedCity = city;
    this.selectedLocality = '';
    this.localities = [];
    this.localitiesLoading.set(true);
    this.closePicker();
    this.locations.localities(city).subscribe((names) => {
      this.localities = names;
      this.localitiesLoading.set(false);
      if (!names.length && !this.cities.includes(city)) {
        this.cities = [...this.cities, city].sort();
      }
    });
  }
}
