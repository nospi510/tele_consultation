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
  consultation: any = {};
  isDoctorTyping: boolean = false;

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
        this.consultation = {
          symptoms: this.symptoms,
          diagnosis: response.is_ai_diagnosis ? response.diagnosis : 'En attente',
          status: 'pending'
        };
        this.messages.push({ sender: 'Patient', text: this.symptoms });

        if (this.consultationId) {
          this.socket.emit('join_consultation', { consultation_id: this.consultationId });
          this.socket.on('consultation_update', (data: any) => {
            this.updateMessages(data.conversation_history);
          });
          this.socket.on('typing_update', (data: any) => {
            if (data.user_role === 'doctor') {
              this.isDoctorTyping = data.is_typing;
            }
          });
        }
      },
      (error) => {
        this.isLoading = false;
        this.showToast('Erreur lors du démarrage', 'danger');
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

  onTyping(event: any) {
    if (this.consultationId) {
      this.socket.emit('typing', { consultation_id: this.consultationId, user_role: 'patient', is_typing: !!this.newMessage });
    }
  }

  continueConsultation() {
    if (!this.newMessage || !this.consultationId) return;

    const token = this.authService.getToken();
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
    const messageToSend = this.newMessage;

    this.messages.push({ sender: 'Patient', text: messageToSend });
    this.newMessage = '';
    this.socket.emit('typing', { consultation_id: this.consultationId, user_role: 'patient', is_typing: false });

    this.http.post(`${environment.apiUrl}/consultation/continue/${this.consultationId}`, { message: messageToSend }, { headers }).subscribe(
      () => this.showToast('Message envoyé', 'success'),
      () => this.showToast('Erreur lors de l’envoi', 'danger')
    );
  }

  goToHome() {
    this.router.navigate(['/home']);
  }

  async showToast(message: string, color: string) {
    const toast = await this.toastController.create({ message, duration: 2000, color, position: 'top' });
    toast.present();
  }
}