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
import { BlogShopIdentity } from '../../models/blog.models';

type ActivePicker = 'city' | 'locality' | null;
type AuthorKind = 'person' | 'shop';

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
  shopPhone = this.identity.identity()?.phoneNumber?.replace(/^\+91/, '') ?? '';
  tags = '';
  authorKind: AuthorKind = 'person';

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
  readonly verifyingShop = signal(false);
  readonly shopIdentity = signal<BlogShopIdentity | null>(null);

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

  setAuthorKind(kind: AuthorKind): void {
    this.authorKind = kind;
    this.error.set('');
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

  onShopPhoneChange(): void {
    this.shopIdentity.set(null);
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
      const shop = await this.blog.verifyShopPhone(phone);
      this.shopIdentity.set(shop);
      if (shop.city && shop.locality) {
        this.selectedCity = shop.city;
        this.selectedLocality = shop.locality;
      }
    } catch {
      this.shopIdentity.set(null);
      this.error.set('No shop found for that phone number.');
    } finally {
      this.verifyingShop.set(false);
    }
  }

  async submit(): Promise<void> {
    this.error.set('');
    if (!this.selectedCity || !this.selectedLocality) {
      this.error.set('Pick a city and locality. This blog is for a junction.');
      return;
    }
    const body = this.body.trim();
    if (!body) {
      this.error.set('Write the complaint or note.');
      return;
    }

    let creatorName = '';
    let creatorNumber = '';
    let nameTag = '';
    let shopId: string | null = null;

    if (this.authorKind === 'shop') {
      const shop = this.shopIdentity();
      if (!shop) {
        this.error.set('Verify a shop phone before creating as a shop.');
        return;
      }
      creatorName = shop.creator_name;
      creatorNumber = shop.creator_number;
      nameTag = shop.name_tag;
      shopId = shop.shop_id;
    } else {
      const name = this.displayName.trim();
      if (!name) {
        this.error.set('A name is enough if you skip a profile.');
        return;
      }
      const who = this.identity.enter(name, this.phoneNumber.trim() || null);
      creatorName = who.displayName;
      creatorNumber = who.userNumber;
      nameTag = who.nameTag;
    }

    const tags = this.tags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
    tags.unshift(nameTag, this.selectedCity, this.selectedLocality);
    this.saving.set(true);
    try {
      const entry = await this.blog.createEntry({
        junction: this.junctionLabel,
        city: this.selectedCity,
        locality: this.selectedLocality,
        body,
        creatorName,
        creatorNumber,
        nameTag,
        tags: [...new Set(tags)],
        authorKind: this.authorKind,
        shopId,
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
