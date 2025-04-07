import { Component, OnInit, ViewChild } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { IonicModule, IonModal } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { io } from 'socket.io-client';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-live-list',
  templateUrl: './live-list.page.html',
  styleUrls: ['./live-list.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
})
export class LiveListPage implements OnInit {
  @ViewChild('createModal') createModal!: IonModal;
  sessions: { id: number; title: string; host: string; broadcasters: string[] }[] = [];
  loading: boolean = true;
  error: string | null = null;
  isDoctor: boolean = false;
  showCreateModal: boolean = false;
  newSessionTitle: string = '';
  private socket: any;

  constructor(
    private http: HttpClient,
    private router: Router,
    private authService: AuthService
  ) {
    this.socket = io(`${environment.apiUrl}/live`, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000
    });
  }

  ngOnInit() {
    this.checkUserRole();
    this.socket.on('connect', () => console.log('WebSocket connecté'));
    this.socket.on('disconnect', () => console.log('WebSocket déconnecté'));
    this.socket.on('new_session', (data: any) => {
      console.log('Nouvelle session reçue:', data);
      this.sessions.push({ id: data.id, title: data.title, host: data.host, broadcasters: [data.host] });
    });
    this.loadSessions();
  }

  checkUserRole() {
    this.isDoctor = this.authService.isDoctor();
  }

  loadSessions() {
    const token = this.authService.getToken();
    this.http.get(`${environment.apiUrl}/tnt/live-session/list`, {
      headers: new HttpHeaders({ Authorization: `Bearer ${token}` })
    }).subscribe({
      next: (data: any) => {
        this.sessions = data;
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Erreur lors du chargement des sessions.';
        this.loading = false;
        console.error('Erreur HTTP:', err);
      }
    });
  }

  openCreateModal() {
    if (this.isDoctor) {
      this.showCreateModal = true;
    } else {
      this.error = 'Seuls les docteurs peuvent créer une session.';
    }
  }

  closeCreateModal() {
    this.showCreateModal = false;
    this.newSessionTitle = '';
  }

  createSession() {
    const token = this.authService.getToken();
    this.http.post(`${environment.apiUrl}/tnt/live-session/create`, { title: this.newSessionTitle }, {
      headers: new HttpHeaders({ Authorization: `Bearer ${token}` })
    }).subscribe({
      next: (response: any) => {
        this.closeCreateModal();
        this.router.navigate(['/live-session', response.session_id]);
      },
      error: (err) => {
        this.error = err.error.error || 'Erreur lors de la création.';
      }
    });
  }

  goToSession(sessionId: number) {
    this.router.navigate(['/live-session', sessionId]);
  }
}