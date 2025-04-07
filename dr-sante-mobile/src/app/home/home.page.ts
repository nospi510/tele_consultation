import { Component, OnInit } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Router } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule]
})
export class HomePage implements OnInit {
  user: any = {};

  constructor(
    private authService: AuthService,
    private http: HttpClient,
    private router: Router
  ) {}

  ngOnInit() {
    if (!this.authService.isLoggedIn()) {
      this.router.navigate(['/login']);
    } else {
      this.loadUserData();
    }
  }

  loadUserData() {
    const token = this.authService.getToken();
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
    this.http.get(`${environment.apiUrl}/auth/home`, { headers }).subscribe(
      (data: any) => {
        this.user = data;
      },
      () => {
        this.authService.logout();
        this.router.navigate(['/login']);
      }
    );
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  goToConsultation() {
    this.router.navigate(['/consultation']);
  }

  goToConsultationHistory() {
    this.router.navigate(['/consultation-history']);
  }

  goToScheduleAppointment() {
    this.router.navigate(['/schedule-appointment']);
  }

  goToUpcomingAppointments() {
    this.router.navigate(['/upcoming-appointments']);
  }

  goToMedicationReminders() {
    this.router.navigate(['/patient-medication-reminders']);
  }

  goToLive() {
    this.router.navigate(['/live-tv']);
  }

  goToDrLive() {
    this.router.navigate(['/live-list']);
  }
}