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
  isTimePickerOpen: boolean = false;

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

  toggleTimePicker() {
    this.isTimePickerOpen = true; // Ouvre le popover
  }

  onTimeChange() {
    this.isTimePickerOpen = false; // Ferme le popover après sélection
  }

  sendReminder() {
    if (!this.patientId || !this.medicationName || !this.dosage || !this.time) {
      this.showToast('Veuillez remplir tous les champs', 'warning');
      return;
    }

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
    this.isTimePickerOpen = false;
  }

  async showToast(message: string, color: string) {
    const toast = await this.toastController.create({ message, duration: 2000, color, position: 'top' });
    toast.present();
  }
}