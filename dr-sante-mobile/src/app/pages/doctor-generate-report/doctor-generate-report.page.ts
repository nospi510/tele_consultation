import { Component, OnInit } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Router } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastController } from '@ionic/angular';

@Component({
  selector: 'app-doctor-generate-report',
  templateUrl: './doctor-generate-report.page.html',
  styleUrls: ['./doctor-generate-report.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
})
export class DoctorGenerateReportPage implements OnInit {
  patients: any[] = [];
  patientId: number | null = null;
  report: any = null;

  constructor(
    private authService: AuthService,
    private http: HttpClient,
    private router: Router,
    private toastController: ToastController
  ) {}

  ngOnInit() {
    if (!this.authService.isLoggedIn() || this.authService.getUserRole() !== 'doctor') {
      this.goToHome();
    } else {
      this.loadPatients();
    }
  }

  loadPatients() {
    const token = this.authService.getToken();
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
    this.http.get(`${environment.apiUrl}/users/`, { headers }).subscribe(
      (data: any) => this.patients = data.filter((user: any) => user.role === 'patient'),
      () => this.goToHome()
    );
  }

  generateReport() {
    const token = this.authService.getToken();
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
    this.http.get(`${environment.apiUrl}/consultation/generate-report/${this.patientId}`, { headers }).subscribe(
      (data: any) => {
        this.report = data;
        this.showToast('Rapport généré avec succès', 'success');
      },
      () => this.showToast('Erreur lors de la génération du rapport', 'danger')
    );
  }

  goToHome() {
    this.router.navigate(['/doctor-dashboard']);
  }

  async showToast(message: string, color: string) {
    const toast = await this.toastController.create({ message, duration: 2000, color, position: 'top' });
    toast.present();
  }
}