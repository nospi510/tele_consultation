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
  selector: 'app-doctor-send-notification',
  templateUrl: './doctor-send-notification.page.html',
  styleUrls: ['./doctor-send-notification.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
})
export class DoctorSendNotificationPage implements OnInit {
  patients: any[] = [];
  patientId: number | null = null;
  message: string = '';

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

  sendNotification() {
    const token = this.authService.getToken();
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
    this.http.post(`${environment.apiUrl}/consultation/send-notification`, {
      patient_id: this.patientId,
      message: this.message
    }, { headers }).subscribe(
      () => {
        this.showToast('Notification envoyée avec succès', 'success');
        this.resetForm();
      },
      () => this.showToast('Erreur lors de l’envoi de la notification', 'danger')
    );
  }

  goToHome() {
    this.router.navigate(['/doctor-dashboard']);
  }

  resetForm() {
    this.patientId = null;
    this.message = '';
  }

  async showToast(message: string, color: string) {
    const toast = await this.toastController.create({ message, duration: 2000, color, position: 'top' });
    toast.present();
  }
}