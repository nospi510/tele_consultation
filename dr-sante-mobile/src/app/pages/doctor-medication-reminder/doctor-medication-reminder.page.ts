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
  selector: 'app-doctor-medication-reminder',
  templateUrl: './doctor-medication-reminder.page.html',
  styleUrls: ['./doctor-medication-reminder.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
})
export class DoctorMedicationReminderPage implements OnInit {
  patients: any[] = [];
  patientId: number | null = null;
  medicationName: string = '';
  dosage: string = '';
  time: string = '';

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
    this.http.get(`${environment.apiUrl}/user/`, { headers }).subscribe(
      (data: any) => this.patients = data.filter((user: any) => user.role === 'patient'),
      () => this.goToHome()
    );
  }

  sendReminder() {
    const token = this.authService.getToken();
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
    this.http.post(`${environment.apiUrl}/consultation/medication-reminder`, {
      patient_id: this.patientId,
      medication_name: this.medicationName,
      dosage: this.dosage,
      time: this.time
    }, { headers }).subscribe(
      () => {
        this.showToast('Rappel envoyé avec succès', 'success');
        this.resetForm();
      },
      () => this.showToast('Erreur lors de l’envoi du rappel', 'danger')
    );
  }

  goToHome() {
    this.router.navigate(['/doctor-dashboard']);
  }

  resetForm() {
    this.patientId = null;
    this.medicationName = '';
    this.dosage = '';
    this.time = '';
  }

  async showToast(message: string, color: string) {
    const toast = await this.toastController.create({ message, duration: 2000, color, position: 'top' });
    toast.present();
  }
}