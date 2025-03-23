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
  selector: 'app-doctor-upcoming-appointments',
  templateUrl: './doctor-upcoming-appointments.page.html',
  styleUrls: ['./doctor-upcoming-appointments.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
})
export class DoctorUpcomingAppointmentsPage implements OnInit {
  appointments: any[] = [];
  statusOptions = ['scheduled', 'planifié', 'terminé'];

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
      this.loadAppointments();
    }
  }

  loadAppointments() {
    const token = this.authService.getToken();
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
    this.http.get(`${environment.apiUrl}/consultation/upcoming-appointments`, { headers }).subscribe(
      (data: any) => this.appointments = data,
      () => this.goToHome()
    );
  }

  updateStatus(appointment: any) {
    const token = this.authService.getToken();
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
    this.http.put(`${environment.apiUrl}/consultation/appointments/${appointment.id}/status`, { status: appointment.status }, { headers }).subscribe(
      () => this.showToast('Statut mis à jour avec succès', 'success'),
      () => this.showToast('Erreur lors de la mise à jour du statut', 'danger')
    );
  }

  cancelAppointment(id: number) {
    const token = this.authService.getToken();
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
    this.http.delete(`${environment.apiUrl}/consultation/cancel-appointment/${id}`, { headers }).subscribe(
      () => {
        this.showToast('Rendez-vous annulé avec succès', 'success');
        this.loadAppointments();
      },
      () => this.showToast('Erreur lors de l’annulation', 'danger')
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