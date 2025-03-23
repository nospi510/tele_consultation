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
  selector: 'app-schedule-appointment',
  templateUrl: './schedule-appointment.page.html',
  styleUrls: ['./schedule-appointment.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
})
export class ScheduleAppointmentPage implements OnInit {
  doctors: any[] = [];
  doctorId: number | null = null;
  appointmentDate: string = '';

  constructor(
    private authService: AuthService,
    private http: HttpClient,
    private router: Router,
    private toastController: ToastController
  ) {}

  ngOnInit() {
    if (!this.authService.isLoggedIn()) {
      this.router.navigate(['/login']);
    } else {
      this.loadDoctors();
    }
  }

  loadDoctors() {
    const token = this.authService.getToken();
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);

    this.http.get(`${environment.apiUrl}/consultation/doctors/available`, { headers }).subscribe(
      (data: any) => this.doctors = data,
      () => this.showToast('Erreur lors du chargement des médecins', 'danger')
    );
  }

  async scheduleAppointment() {
    const token = this.authService.getToken();
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);

    this.http.post(`${environment.apiUrl}/consultation/schedule-appointment`, {
      doctor_id: this.doctorId,
      appointment_date: this.appointmentDate
    }, { headers }).subscribe(
      async () => {
        await this.showToast('Rendez-vous planifié avec succès !', 'success');
        this.router.navigate(['/home']);
      },
      async () => await this.showToast('Erreur lors de la planification', 'danger')
    );
  }

  async showToast(message: string, color: string) {
    const toast = await this.toastController.create({ message, duration: 2000, color, position: 'top' });
    toast.present();
  }

  goToHome() {
    this.router.navigate(['/home']);
  }
}