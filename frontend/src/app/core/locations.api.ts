import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import { API_BASE_URL } from './api.config';

interface CityListResponse {
  cities: string[];
}

interface LocalityListResponse {
  city: string;
  localities: string[];
}

export interface AddJunctionResponse {
  city: string;
  locality: string;
}

@Injectable({ providedIn: 'root' })
export class LocationsApi {
  private readonly http = inject(HttpClient);

  cities(): Observable<string[]> {
    return this.http.get<CityListResponse | string[]>(`${API_BASE_URL}/locations/cities`).pipe(
      map((response) => (Array.isArray(response) ? response : (response?.cities ?? []))),
      catchError(() => of([])),
    );
  }

  localities(city: string): Observable<string[]> {
    const trimmed = city.trim();
    if (!trimmed) {
      return of([]);
    }
    const params = new HttpParams({ fromObject: { city: trimmed } });
    return this.http
      .get<LocalityListResponse | string[]>(`${API_BASE_URL}/locations/localities`, { params })
      .pipe(
        map((response) => (Array.isArray(response) ? response : (response?.localities ?? []))),
        catchError(() => of([])),
      );
  }

  addJunction(city: string, locality: string): Observable<AddJunctionResponse> {
    return this.http.post<AddJunctionResponse>(`${API_BASE_URL}/locations/add-junction`, {
      city: city.trim(),
      locality: locality.trim(),
    });
  }
}
