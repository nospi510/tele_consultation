import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-consultation-detail',
  templateUrl: './consultation-detail.page.html',
  styleUrls: ['./consultation-detail.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule]
})
export class ConsultationDetailPage implements OnInit {
  consultation: any = {};

  constructor(
    private route: ActivatedRoute,
    private authService: AuthService,
    private http: HttpClient,
    private router: Router
  ) {}

  ngOnInit() {
    if (!this.authService.isLoggedIn()) {
      this.router.navigate(['/login']);
    } else {
      const id = this.route.snapshot.paramMap.get('id');
      this.loadConsultation(id);
    }
  }

  loadConsultation(id: string | null) {
    const token = this.authService.getToken();
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
    this.http.get(`${environment.apiUrl}/consultation/${id}`, { headers }).subscribe(
      (data: any) => {
        this.consultation = data;
        if (this.consultation.status !== 'terminée') {
          this.router.navigate([`/ongoing-consultation/${id}`]);
        }
      },
      (error) => {
        console.error('Erreur lors du chargement :', error);
        this.router.navigate(['/consultation-history']);
      }
    );
  }
}