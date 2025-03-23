import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { Observable, interval } from 'rxjs';
import { switchMap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class RefreshService {
  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  // Méthode générique pour rafraîchir une URL toutes les X secondes
  refreshData<T>(url: string, intervalTime: number = 5000): Observable<T> {
    const token = this.authService.getToken();
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);

    return interval(intervalTime).pipe(
      switchMap(() => this.http.get<T>(url, { headers }))
    );
  }
}