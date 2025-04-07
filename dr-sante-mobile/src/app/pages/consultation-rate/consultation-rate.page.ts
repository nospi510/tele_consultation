import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Router } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastController } from '@ionic/angular';

@Component({
  selector: 'app-consultation-rate',
  templateUrl: './consultation-rate.page.html',
  styleUrls: ['./consultation-rate.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
})
export class ConsultationRatePage implements OnInit {
  consultationId: number;
  rating: number = 0;
  comment: string = '';

  constructor(
    private route: ActivatedRoute,
    private authService: AuthService,
    private http: HttpClient,
    private router: Router,
    private toastController: ToastController
  ) {
    this.consultationId = +this.route.snapshot.paramMap.get('id')!;
  }

  ngOnInit() {
    if (!this.authService.isLoggedIn()) {
      this.router.navigate(['/login']);
    }
  }

  async rateConsultation() {
    const token = this.authService.getToken();
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);

    this.http.post(`${environment.apiUrl}/consultation/rate/${this.consultationId}`, { rating: this.rating, comment: this.comment }, { headers }).subscribe(
      async () => {
        await this.showToast('Consultation notée avec succès !', 'success');
        this.router.navigate(['/home']);
      },
      async () => await this.showToast('Erreur lors de la notation', 'danger')
    );
  }

  async showToast(message: string, color: string) {
    const toast = await this.toastController.create({ message, duration: 2000, color, position: 'top' });
    toast.present();
  }
}