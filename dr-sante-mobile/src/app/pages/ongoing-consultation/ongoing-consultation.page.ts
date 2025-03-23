import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastController } from '@ionic/angular';
import { Socket } from 'ngx-socket-io';

@Component({
  selector: 'app-ongoing-consultation',
  templateUrl: './ongoing-consultation.page.html',
  styleUrls: ['./ongoing-consultation.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
})
export class OngoingConsultationPage implements OnInit, OnDestroy {
  consultation: any = {};
  newMessage: string = '';
  messages: { sender: string; text: string }[] = [];

  constructor(
    private route: ActivatedRoute,
    private authService: AuthService,
    private http: HttpClient,
    private router: Router,
    private toastController: ToastController,
    private socket: Socket
  ) {}

  ngOnInit() {
    if (!this.authService.isLoggedIn()) {
      this.goToLogin();
    } else {
      const id = this.route.snapshot.paramMap.get('id');
      if (id) {
        this.loadConsultation(id);
        this.socket.emit('join_consultation', { consultation_id: id });
        this.socket.on('consultation_update', (data: any) => {
          this.updateMessages(data.conversation_history);
        });
      } else {
        this.goToHome();
      }
    }
  }

  ngOnDestroy() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.socket.emit('leave_consultation', { consultation_id: id });
    }
  }

  loadConsultation(id: string) {
    const token = this.authService.getToken();
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
    this.http.get(`${environment.apiUrl}/consultation/${id}`, { headers }).subscribe(
      (data: any) => {
        this.consultation = data;
        if (this.consultation.status === 'terminée') {
          this.router.navigate([`/consultation-detail/${id}`]);
        } else {
          this.updateMessages(this.consultation.conversation_history);
        }
      },
      (error) => {
        console.error('Erreur lors du chargement :', error);
        this.goToHome();
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
    if (!this.newMessage || !this.consultation.id) return;

    const token = this.authService.getToken();
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
    const messageToSend = this.newMessage;

    // Ajoute immédiatement le message localement
    this.messages.push({ sender: 'Patient', text: messageToSend });
    this.newMessage = '';

    this.http.post(`${environment.apiUrl}/consultation/continue/${this.consultation.id}`, { message: messageToSend }, { headers }).subscribe(
      (response: any) => this.showToast('Message envoyé avec succès', 'success'),
      (error) => this.showToast('Erreur lors de l’envoi du message', 'danger')
    );
  }

  stopAndRate() {
    this.router.navigate([`/consultation-rate/${this.consultation.id}`]);
  }

  goToHome() {
    this.router.navigate(['/home']);
  }

  goToLogin() {
    this.router.navigate(['/login']);
  }

  async showToast(message: string, color: string) {
    const toast = await this.toastController.create({ message, duration: 2000, color, position: 'top' });
    toast.present();
  }
}