import { Component, OnInit } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { io } from 'socket.io-client';

@Component({
  selector: 'app-live-list',
  templateUrl: './live-list.page.html',
  styleUrls: ['./live-list.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule]
})
export class LiveListPage implements OnInit {
  sessions: any[] = [];
  socket: any;

  constructor(
    private http: HttpClient,
    public authService: AuthService ,
    private router: Router
  ) {
    this.socket = io(`${environment.apiUrl}`, { path: '/live' });
  }

  ngOnInit() {
    this.loadSessions();
    this.socket.on('new_session', (session: any) => {
      this.sessions.push(session);
    });
  }

  loadSessions() {
    this.http.get(`${environment.apiUrl}/tnt/live-session/list`, {
      headers: { Authorization: `Bearer ${this.authService.getToken()}` }
    }).subscribe((data: any) => {
      this.sessions = data;
    });
  }

  createSession() {
    if (!this.authService.isDoctor()) {
      alert('Seuls les docteurs peuvent créer une session');
      return;
    }
    const title = prompt('Entrez le titre de la session :');
    if (title) {
      this.http.post(`${environment.apiUrl}/tnt/live-session/create`, { title }, {
        headers: { Authorization: `Bearer ${this.authService.getToken()}` }
      }).subscribe((res: any) => {
        this.router.navigate(['/live-session', res.session_id]);
      });
    }
  }

  joinSession(sessionId: number) {
    this.router.navigate(['/live-session', sessionId]);
  }
}