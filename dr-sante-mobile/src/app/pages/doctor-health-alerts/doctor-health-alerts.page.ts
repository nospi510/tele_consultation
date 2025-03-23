import { Component, OnInit } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Router } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-doctor-health-alerts',
  templateUrl: './doctor-health-alerts.page.html',
  styleUrls: ['./doctor-health-alerts.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule]
})
export class DoctorHealthAlertsPage implements OnInit {
  alerts: any[] = [];

  constructor(
    private authService: AuthService,
    private http: HttpClient,
    private router: Router
  ) {}

  ngOnInit() {
    if (!this.authService.isLoggedIn() || this.authService.getUserRole() !== 'doctor') {
      this.goToHome();
    } else {
      this.loadAlerts();
    }
  }

  loadAlerts() {
    const token = this.authService.getToken();
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
    this.http.get(`${environment.apiUrl}/consultation/health-alerts`, { headers }).subscribe(
      (data: any) => this.alerts = data,
      () => this.goToHome()
    );
  }

  goToHome() {
    this.router.navigate(['/doctor-dashboard']);
  }

  goToConsultationDetail(id: number) {
    this.router.navigate(['/doctor/consultation-detail', id]);
  }
}