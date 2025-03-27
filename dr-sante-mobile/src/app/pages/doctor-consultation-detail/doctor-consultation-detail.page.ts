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
  selector: 'app-doctor-consultation-detail',
  templateUrl: './doctor-consultation-detail.page.html',
  styleUrls: ['./doctor-consultation-detail.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
})
export class DoctorConsultationDetailPage implements OnInit, OnDestroy {
  consultation: any = {};
  newMessage: string = '';
  reminderMessage: string = '';
  statusOptions = ['pending', 'en cours', 'terminée', 'annulée'];
  selectedStatus: string = '';
  messages: { sender: string; text: string }[] = [];
  isPatientTyping: boolean = false;

  constructor(
    private route: ActivatedRoute,
    private authService: AuthService,
    private http: HttpClient,
    private router: Router,
    private toastController: ToastController,
    private socket: Socket
  ) {}

  ngOnInit() {
    if (!this.authService.isLoggedIn() || this.authService.getUserRole() !== 'doctor') {
      this.goToHome();
    } else {
      const id = this.route.snapshot.paramMap.get('id');
      if (id) {
        this.loadConsultation(id);
        this.setupWebSocket(id);
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
    this.http.get(`${environment.apiUrl}/consultation/doctor/${id}`, { headers }).subscribe(
      (data: any) => {
        this.consultation = data;
        this.selectedStatus = this.consultation.status || 'pending';
        this.updateMessages(this.consultation.conversation_history);
      },
      (error) => {
        console.error('Erreur chargement:', error);
        this.goToHome();
      }
    );
  }

  setupWebSocket(id: string) {
    this.socket.emit('join_consultation', { consultation_id: id });
    this.socket.on('consultation_update', (data: any) => {
      this.consultation.conversation_history = data.conversation_history || this.consultation.conversation_history;
      this.consultation.status = data.status || this.consultation.status;
      this.consultation.diagnosis = data.diagnosis || this.consultation.diagnosis;
      this.checkMessageSync(data.conversation_history); // Nouveau : Vérifie la synchronisation
      this.updateMessages(this.consultation.conversation_history);
    });
    this.socket.on('typing_update', (data: any) => {
      this.isPatientTyping = data.user_role === 'patient' && data.is_typing;
    });
  }

  updateMessages(conversationHistory: string) {
    if (!conversationHistory) {
      this.messages = [];
      return;
    }
    const newMessages = conversationHistory.split('\n')
      .filter(line => line.trim())
      .map(line => {
        const [sender, ...textParts] = line.split(': ');
        return { sender: sender.trim(), text: textParts.join(': ').trim() };
      });
    this.messages = newMessages.filter((msg, index, self) =>
      index === self.findIndex(m => m.sender === msg.sender && m.text === msg.text)
    );
  }

  // Nouveau : Vérifie si les messages locaux correspondent au backend
  checkMessageSync(serverHistory: string) {
    const localHistory = this.messages.map(msg => `${msg.sender}: ${msg.text}`).join('\n');
    if (serverHistory && serverHistory.trim() !== localHistory.trim()) {
      this.showToast('Messages synchronisés avec le serveur', 'warning');
    }
  }

  onTyping(event: any) {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.socket.emit('typing', { consultation_id: id, user_role: 'doctor', is_typing: !!this.newMessage });
    }
  }

  continueConsultation() {
    if (!this.newMessage || !this.consultation.id) return;

    const token = this.authService.getToken();
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
    const messageToSend = this.newMessage;

    this.messages.push({ sender: 'Médecin', text: messageToSend });
    this.newMessage = '';
    this.socket.emit('typing', { consultation_id: this.consultation.id, user_role: 'doctor', is_typing: false });

    this.http.post(`${environment.apiUrl}/consultation/doctor/continue/${this.consultation.id}`, { message: messageToSend }, { headers }).subscribe(
      () => this.showToast('Message envoyé', 'success'),
      (error) => {
        console.error('Erreur envoi:', error);
        this.showToast('Erreur envoi', 'danger');
      }
    );
  }

  updateStatus() {
    const token = this.authService.getToken();
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
    this.http.put(`${environment.apiUrl}/consultation/status/${this.consultation.id}`, { status: this.selectedStatus }, { headers }).subscribe(
      () => {
        this.consultation.status = this.selectedStatus;
        this.showToast('Statut mis à jour', 'success');
      },
      (error) => {
        console.error('Erreur statut:', error);
        this.showToast('Erreur statut', 'danger');
      }
    );
  }

  sendReminder() {
    const token = this.authService.getToken();
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
    this.http.post(`${environment.apiUrl}/consultation/reminder/${this.consultation.id}`, { reminder_message: this.reminderMessage }, { headers }).subscribe(
      () => {
        this.reminderMessage = '';
        this.showToast('Rappel envoyé', 'success');
      },
      (error) => {
        console.error('Erreur rappel:', error);
        this.showToast('Erreur rappel', 'danger');
      }
    );
  }

  goToHome() {
    this.router.navigate(['/doctor-dashboard']);
  }

  async showToast(message: string, color: string) {
    const toast = await this.toastController.create({ message, duration: 2000, color, position: 'top' });
    toast.present();
  }
}