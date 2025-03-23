import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = `${environment.apiUrl}/auth`;

  constructor(private http: HttpClient) {}

  register(fullname: string, email: string, password: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/register`, { fullname, email, password });
  }

  login(email: string, password: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/login`, { email, password }).pipe(
      tap((response: any) => {
        if (response.access_token) {
          localStorage.setItem('token', response.access_token);
        }
        if (response.user_role) {  // 🔹 Stocke le rôle utilisateur
          localStorage.setItem('user_role', response.user_role);
        }
      })
    );
  }

  logout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('user_role'); // 🔹 Supprime le rôle utilisateur
  }

  getToken(): string | null {
    return localStorage.getItem('token');
  }

  getUserRole(): string | null {
    return localStorage.getItem('user_role');  // 🔹 Récupère le rôle utilisateur
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }
}
