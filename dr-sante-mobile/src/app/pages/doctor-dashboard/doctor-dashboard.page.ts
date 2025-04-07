import { Component, OnInit } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Router } from '@angular/router';
import { IonicModule, LoadingController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastController } from '@ionic/angular';

@Component({
  selector: 'app-doctor-dashboard',
  templateUrl: './doctor-dashboard.page.html',
  styleUrls: ['./doctor-dashboard.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
})
export class DoctorDashboardPage implements OnInit {
  user: any = {};
  isAvailable: boolean = false;
  isLoading: boolean = false;

  constructor(
    private authService: AuthService,
    private http: HttpClient,
    private router: Router,
    private toastController: ToastController,
    private loadingController: LoadingController
  ) {}

  ngOnInit() {
    if (!this.authService.isLoggedIn()) {
      this.goToLogin();
    } else if (this.authService.getUserRole() !== 'doctor') {
      this.goToHome();
    } else {
      this.loadUserData();
    }
  }

  loadUserData() {
    const token = this.authService.getToken();
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
    this.http.get(`${environment.apiUrl}/users/me`, { headers }).subscribe(
      (data: any) => {
        this.user = data;
        this.isAvailable = data.is_available || false; // Initialisation correcte
        console.log('État initial de isAvailable :', this.isAvailable); // Log pour vérifier
      },
      () => this.goToLogin()
    );
  }

  async toggleAvailability(event: any) { // Ajout de l'événement pour capturer la valeur du toggle
    if (this.isLoading) return;

    this.isLoading = true;
    const newAvailability = event.detail.checked; // Récupère directement la valeur du toggle
    console.log('Valeur envoyée au backend :', newAvailability); // Log avant envoi

    const loading = await this.loadingController.create({
      message: 'Mise à jour de la disponibilité...',
      duration: 5000
    });
    await loading.present();

    const token = this.authService.getToken();
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);

    this.http.put(`${environment.apiUrl}/users/availability`, { is_available: newAvailability }, { headers }).subscribe({
      next: (response: any) => {
        this.isAvailable = response.is_available; // Mise à jour avec la réponse du backend
        console.log('Réponse du backend :', response); // Log après réception
        this.showToast(`Disponibilité mise à jour : ${this.isAvailable ? 'ON' : 'OFF'}`, 'success');
        loading.dismiss();
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Erreur détaillée :', error);
        this.isAvailable = !newAvailability; // Rétablit l’état précédent en cas d’erreur
        this.showToast('Erreur lors de la mise à jour de la disponibilité', 'danger');
        loading.dismiss();
        this.isLoading = false;
      }
    });
  }

  goToLogin() {
    this.router.navigate(['/login']);
  }

  goToHome() {
    this.router.navigate(['/home']);
  }

  goToDoctorConsultations() {
    this.router.navigate(['/doctor/consultations']);
  }

  goToHealthAlerts() {
    this.router.navigate(['/doctor/health-alerts']);
  }

  goToMedicationReminder() {
    this.router.navigate(['/doctor/medication-reminder']);
  }

  goToGenerateReport() {
    this.router.navigate(['/doctor/generate-report']);
  }

  goToSendNotification() {
    this.router.navigate(['/doctor/send-notification']);
  }

  goToUpcomingAppointments() {
    this.router.navigate(['/doctor/upcoming-appointments']);
  }

createLiveSession() {
    const title = prompt('Entrez le titre de la session live :');
    if (title) {
      this.http.post(`${environment.apiUrl}/tnt/live-session/create`, { title }, {
        headers: { Authorization: `Bearer ${this.authService.getToken()}` }
      }).subscribe({
        next: (response: any) => {
          this.router.navigate(['/live-session', response.session_id]);
        },
        error: (err) => {
          console.error('Erreur lors de la création de la session', err);
          alert('Erreur lors de la création de la session');
        }
      });
    }
  }

  goToLiveList() {
    this.router.navigate(['/live-list']);
  }
  logout() {
    this.authService.logout();
    this.goToLogin();
  }

  async showToast(message: string, color: string) {
    const toast = await this.toastController.create({ message, duration: 2000, color, position: 'top' });
    toast.present();
  }
}