import { Component, OnInit, OnDestroy } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Router } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastController } from '@ionic/angular';
import { Socket } from 'ngx-socket-io';

@Component({
  selector: 'app-consultation',
  templateUrl: './consultation.page.html',
  styleUrls: ['./consultation.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
})
export class ConsultationPage implements OnInit, OnDestroy {
  symptoms: string = '';
  isLoading: boolean = false;
  countdown: number = 10;
  consultationStarted: boolean = false;
  messages: { sender: string; text: string }[] = [];
  newMessage: string = '';
  consultationId: number | null = null;
  isAIDiagnosis: boolean = false;

  constructor(
    private authService: AuthService,
    private http: HttpClient,
    private router: Router,
    private toastController: ToastController,
    private socket: Socket
  ) {}

  ngOnInit() {
    if (!this.authService.isLoggedIn()) {
      this.router.navigate(['/login']);
    }
  }

  ngOnDestroy() {
    if (this.consultationId) {
      this.socket.emit('leave_consultation', { consultation_id: this.consultationId });
    }
  }

  async startConsultation() {
    this.isLoading = true;
    this.countdown = 10;

    const timer = setInterval(() => {
      this.countdown--;
      if (this.countdown === 0) {
        clearInterval(timer);
        this.checkDoctorAvailability();
      }
    }, 1000);
  }

  checkDoctorAvailability() {
    const token = this.authService.getToken();
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);

    this.http.post(`${environment.apiUrl}/consultation/start`, { symptoms: this.symptoms }, { headers }).subscribe(
      (response: any) => {
        this.isLoading = false;
        this.consultationStarted = true;
        this.consultationId = response.consultation_id;
        this.isAIDiagnosis = response.is_ai_diagnosis;

        // Initialise les messages localement
        if (this.isAIDiagnosis) {
          this.messages.push({ sender: 'Vous', text: this.symptoms });
          this.messages.push({ sender: 'IA', text: response.diagnosis || 'Décrivez vos symptômes pour un diagnostic initial.' });
        } else {
          this.messages.push({ sender: 'Vous', text: this.symptoms });
          this.messages.push({ sender: 'Système', text: 'Un médecin est disponible. Discussion démarrée.' });
        }

        // Rejoint la salle WebSocket
        if (this.consultationId) {
          this.socket.emit('join_consultation', { consultation_id: this.consultationId });
          this.socket.on('consultation_update', (data: any) => {
            this.updateMessages(data.conversation_history);
          });
        }
      },
      (error) => {
        this.isLoading = false;
        this.showToast('Erreur lors du démarrage de la consultation', 'danger');
      }
    );
  }

  updateMessages(conversationHistory: string) {
    this.messages = [];
    if (conversationHistory) {
      const lines = conversationHistory.split('\n');
      lines.forEach((line: string) => {
        if (line.trim()) {
          const [sender, ...textParts] = line.split(': ');
          const senderText = sender.trim();
          const messageText = textParts.join(': ').trim();
          if (!this.messages.some(msg => msg.sender === senderText && msg.text === messageText)) {
            this.messages.push({ sender: senderText, text: messageText });
          }
        }
      });
    }
  }

  continueConsultation() {
    if (!this.newMessage || !this.consultationId) return;

    const token = this.authService.getToken();
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
    const messageToSend = this.newMessage;

    // Ajoute immédiatement le message localement
    this.messages.push({ sender: 'Vous', text: messageToSend });
    this.newMessage = '';

    this.http.post(`${environment.apiUrl}/consultation/continue/${this.consultationId}`, { message: messageToSend }, { headers }).subscribe(
      (response: any) => {
        this.showToast('Message envoyé avec succès', 'success');
        if (this.isAIDiagnosis && response.diagnosis) {
          this.messages.push({ sender: 'IA', text: response.diagnosis });
        }
      },
      (error) => this.showToast('Erreur lors de la poursuite de la consultation', 'danger')
    );
  }

  stopAndRate() {
    if (this.consultationId) {
      this.router.navigate([`/consultation-rate/${this.consultationId}`]);
    }
  }

  goToHome() {
    this.router.navigate(['/home']);
  }

  async showToast(message: string, color: string) {
    const toast = await this.toastController.create({ message, duration: 2000, color, position: 'top' });
    toast.present();
  }
}