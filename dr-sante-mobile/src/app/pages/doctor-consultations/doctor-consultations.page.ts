import { Component, OnInit } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Router } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-doctor-consultations',
  templateUrl: './doctor-consultations.page.html',
  styleUrls: ['./doctor-consultations.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule]
})
export class DoctorConsultationsPage implements OnInit {
  consultations: any[] = [];

  constructor(
    private authService: AuthService,
    private http: HttpClient,
    private router: Router
  ) {}

  ngOnInit() {
    if (!this.authService.isLoggedIn() || this.authService.getUserRole() !== 'doctor') {
      this.goToHome();
    } else {
      this.loadConsultations();
    }
  }

  loadConsultations() {
    const token = this.authService.getToken();
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
    this.http.get(`${environment.apiUrl}/consultation/doctor/consultations`, { headers }).subscribe(
      (data: any) => this.consultations = data,
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