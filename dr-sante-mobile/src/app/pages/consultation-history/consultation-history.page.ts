import { Component, OnInit } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Router } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-consultation-history',
  templateUrl: './consultation-history.page.html',
  styleUrls: ['./consultation-history.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule]
})
export class ConsultationHistoryPage implements OnInit {
  consultations: any[] = [];

  constructor(
    private authService: AuthService,
    private http: HttpClient,
    private router: Router
  ) {}

  ngOnInit() {
    if (!this.authService.isLoggedIn()) {
      this.router.navigate(['/login']);
    } else {
      this.loadConsultations();
    }
  }

  loadConsultations() {
    const token = this.authService.getToken();
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);

    this.http.get(`${environment.apiUrl}/consultation/all`, { headers }).subscribe(
      (data: any) => this.consultations = data,
      () => this.router.navigate(['/home'])
    );
  }
  
  goToHome() {
    this.router.navigate(['/home']);
  }

  goToConsultationDetail(id: number) {
    this.router.navigate(['/consultation-detail', id]);
  }
}