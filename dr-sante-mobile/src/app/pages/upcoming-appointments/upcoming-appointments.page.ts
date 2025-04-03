import { Component, OnInit } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Router } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { ToastController } from '@ionic/angular';

@Component({
  selector: 'app-upcoming-appointments',
  templateUrl: './upcoming-appointments.page.html',
  styleUrls: ['./upcoming-appointments.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule]
})
export class UpcomingAppointmentsPage implements OnInit {
  appointments: any[] = [];

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
      this.loadAppointments();
    }
  }

  loadAppointments() {
    const token = this.authService.getToken();
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);

    this.http.get(`${environment.apiUrl}/consultation/upcoming-appointments`, { headers }).subscribe(
      (data: any) => this.appointments = data,
      () => this.showToast('Erreur lors du chargement des rendez-vous', 'danger')
    );
  }

  async cancelAppointment(id: number) {
    const token = this.authService.getToken();
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);

    this.http.delete(`${environment.apiUrl}/consultation/cancel-appointment/${id}`, { headers }).subscribe(
      async () => {
        await this.showToast('Rendez-vous annulé avec succès', 'success');
        this.loadAppointments();
      },
      async () => await this.showToast('Erreur lors de l’annulation', 'danger')
    );
  }

  async showToast(message: string, color: string) {
    const toast = await this.toastController.create({ message, duration: 2000, color, position: 'top' });
    toast.present();
  }

  goToHome() {
    this.router.navigate(['/home']);
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'planifié':
        return 'warning'; // Jaune
      case 'en cours':
        return 'primary'; // Bleu
      case 'terminé':
        return 'success'; // Vert
      case 'annulé':
        return 'danger'; // Rouge
      default:
        return 'medium'; // Gris
    }
  }
}