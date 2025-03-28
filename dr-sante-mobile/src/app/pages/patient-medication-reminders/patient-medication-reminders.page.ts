import { Component, OnInit } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Router } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common'; // Ajouté pour la pipe 'date'
import { ToastController } from '@ionic/angular';

@Component({
  selector: 'app-patient-medication-reminders',
  templateUrl: './patient-medication-reminders.page.html',
  styleUrls: ['./patient-medication-reminders.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule] // CommonModule ajouté ici
})
export class PatientMedicationRemindersPage implements OnInit {
  reminders: any[] = [];

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
      this.loadReminders();
    }
  }

  loadReminders() {
    const token = this.authService.getToken();
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);

    this.http.get(`${environment.apiUrl}/consultation/patient/medication-reminders`, { headers }).subscribe(
      (data: any) => this.reminders = data,
      () => this.showToast('Erreur lors du chargement des rappels', 'danger')
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