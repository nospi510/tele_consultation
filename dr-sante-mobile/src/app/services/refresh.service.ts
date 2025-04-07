import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class RefreshService {
  private consultationData = new BehaviorSubject<any>(null);
  private intervalId: any;

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  // Démarre le rafraîchissement pour une consultation spécifique
  startRefresh(consultationId: string, endpoint: string): Observable<any> {
    this.stopRefresh(); // Arrête tout intervalle existant

    this.loadData(consultationId, endpoint); // Charge initialement
    this.intervalId = setInterval(() => {
      this.loadData(consultationId, endpoint);
    }, 500); // Toutes les 0,5 secondes

    return this.consultationData.asObservable();
  }

  // Arrête le rafraîchissement
  stopRefresh() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  // Charge les données depuis l’API
  private loadData(consultationId: string, endpoint: string) {
    const token = this.authService.getToken();
    if (!token) return;

    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
    this.http.get(`${environment.apiUrl}${endpoint}/${consultationId}`, { headers }).subscribe(
      (data: any) => {
        this.consultationData.next(data); // Met à jour les données
      },
      (error) => {
        console.error('Erreur lors du rafraîchissement:', error);
      }
    );
  }
}