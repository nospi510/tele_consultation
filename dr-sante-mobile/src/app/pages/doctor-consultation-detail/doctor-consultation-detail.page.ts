import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastController } from '@ionic/angular';
import { Socket } from 'ngx-socket-io';
import Peer from 'peerjs';

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
  diagnosisInput: string = ''; // Nouvelle propriété pour le diagnostic
  statusOptions = ['pending', 'en cours', 'terminée', 'annulée'];
  selectedStatus: string = '';
  messages: { sender: string; text: string; timestamp: Date }[] = [];
  isPatientTyping: boolean = false;
  inCall: boolean = false;
  localStream: MediaStream | null = null;
  peerConnection: RTCPeerConnection | null = null;
  peer: Peer | null = null;

  @ViewChild('localVideo', { static: false }) localVideo!: ElementRef<HTMLVideoElement>;
  @ViewChild('remoteVideo', { static: false }) remoteVideo!: ElementRef<HTMLVideoElement>;

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
    this.endCall();
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
      this.checkMessageSync(data.conversation_history);
      this.updateMessages(this.consultation.conversation_history);
    });
    this.socket.on('typing_update', (data: any) => {
      this.isPatientTyping = data.user_role === 'patient' && data.is_typing;
    });
    this.socket.on('call_joined', (data: any) => {
      console.log('Médecin - Patient a rejoint:', data.user_id);
      this.startCall();
    });
    this.socket.on('webrtc_offer', (data: any) => this.handleOffer(data));
    this.socket.on('webrtc_answer', (data: any) => this.handleAnswer(data));
    this.socket.on('webrtc_ice_candidate', (data: any) => this.handleIceCandidate(data));
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
          const timestampMatch = messageText.match(/\[(.*?)\]$/);
          let messageContent = messageText;
          let timestamp = new Date();

          if (timestampMatch) {
            messageContent = messageText.replace(timestampMatch[0], '').trim();
            timestamp = new Date(timestampMatch[1]);
          }

          if (!this.messages.some(msg => msg.sender === senderText && msg.text === messageContent)) {
            this.messages.push({ sender: senderText, text: messageContent, timestamp });
          }
        }
      });
    }
  }

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

    this.messages.push({ sender: 'Médecin', text: messageToSend, timestamp: new Date() });
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

  sendDiagnosis() {
    if (!this.diagnosisInput || !this.consultation.id) return;

    const token = this.authService.getToken();
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
    const diagnosisToSend = this.diagnosisInput;

    this.diagnosisInput = '';

    this.http.post(`${environment.apiUrl}/consultation/doctor/diagnosis/${this.consultation.id}`, { diagnosis: diagnosisToSend }, { headers }).subscribe(
      () => {
        this.consultation.diagnosis = diagnosisToSend; // Met à jour l'affichage local
        this.showToast('Diagnostic envoyé', 'success');
      },
      (error) => {
        console.error('Erreur envoi diagnostic:', error);
        this.showToast('Erreur envoi diagnostic', 'danger');
      }
    );
  }

  async proposeCall() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id && !this.inCall) {
      const doctorId = this.authService.getUserId();
      console.log('Médecin - Proposition appel:', id);
      this.inCall = true;
      await this.initializeWebRTC();
      this.socket.emit('propose_call', { consultation_id: id, doctor_id: doctorId });
      this.showToast('Appel proposé au patient', 'primary');
    }
  }

  async initializeWebRTC() {
    try {
      const userId = this.authService.getUserId();
      if (!userId) throw new Error('User ID non disponible');

      this.peer = new Peer(`doctor-${userId}-${this.consultation.id}`, {
        host: 'localhost',
        port: 9001,
        path: '/',
        debug: 3
      });

      this.peer.on('open', () => {
        console.log('Médecin - PeerJS connecté:', this.peer!.id);
      });

      this.peer.on('error', (err) => {
        console.error('Médecin - Erreur PeerJS:', err);
        this.showToast('Erreur connexion PeerJS', 'danger');
        this.endCall();
      });

      this.localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      this.localVideo.nativeElement.srcObject = this.localStream;

      this.peerConnection = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          {
            urls: 'turn:openrelay.metered.ca:80',
            username: 'openrelayproject',
            credential: 'openrelayproject'
          }
        ]
      });

      this.localStream.getTracks().forEach(track => {
        this.peerConnection!.addTrack(track, this.localStream!);
      });

      this.peerConnection.ontrack = (event) => {
        console.log('Médecin - Flux distant reçu:', event.streams[0]);
        this.remoteVideo.nativeElement.srcObject = event.streams[0];
      };

      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          console.log('Médecin - Envoi ICE candidate');
          this.socket.emit('webrtc_ice_candidate', {
            consultation_id: this.consultation.id,
            candidate: event.candidate
          });
        }
      };

      this.peerConnection.onconnectionstatechange = () => {
        console.log('Médecin - État connexion:', this.peerConnection!.connectionState);
        if (this.peerConnection!.connectionState === 'connected') {
          this.showToast('Appel connecté', 'success');
        } else if (this.peerConnection!.connectionState === 'failed') {
          this.showToast('Échec connexion appel', 'danger');
          this.endCall();
        }
      };
    } catch (error) {
      console.error('Médecin - Erreur WebRTC:', error);
      this.showToast('Erreur lors de l’initialisation de l’appel', 'danger');
      this.endCall();
    }
  }

  async startCall() {
    try {
      const offer = await this.peerConnection!.createOffer();
      await this.peerConnection!.setLocalDescription(offer);
      console.log('Médecin - Envoi offre');
      this.socket.emit('webrtc_offer', {
        consultation_id: this.consultation.id,
        sdp: offer
      });
    } catch (error) {
      console.error('Médecin - Erreur création offre:', error);
      this.showToast('Erreur démarrage appel', 'danger');
      this.endCall();
    }
  }

  async handleOffer(data: any) {
    try {
      console.log('Médecin - Réception offre:', data.sdp);
      await this.peerConnection!.setRemoteDescription(new RTCSessionDescription(data.sdp));
      const answer = await this.peerConnection!.createAnswer();
      await this.peerConnection!.setLocalDescription(answer);
      console.log('Médecin - Envoi réponse');
      this.socket.emit('webrtc_answer', {
        consultation_id: this.consultation.id,
        sdp: answer
      });
    } catch (error) {
      console.error('Médecin - Erreur traitement offre:', error);
      this.showToast('Erreur traitement offre', 'danger');
    }
  }

  async handleAnswer(data: any) {
    try {
      console.log('Médecin - Réception réponse:', data.sdp);
      await this.peerConnection!.setRemoteDescription(new RTCSessionDescription(data.sdp));
    } catch (error) {
      console.error('Médecin - Erreur traitement réponse:', error);
      this.showToast('Erreur traitement réponse', 'danger');
    }
  }

  async handleIceCandidate(data: any) {
    try {
      console.log('Médecin - Réception ICE candidate');
      await this.peerConnection!.addIceCandidate(new RTCIceCandidate(data.candidate));
    } catch (error) {
      console.error('Médecin - Erreur ajout ICE candidate:', error);
      this.showToast('Erreur ajout ICE candidate', 'danger');
    }
  }

  endCall() {
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
    this.inCall = false;
    this.localVideo.nativeElement.srcObject = null;
    this.remoteVideo.nativeElement.srcObject = null;
  }

  goToHome() {
    this.router.navigate(['/doctor-dashboard']);
  }

  async showToast(message: string, color: string) {
    const toast = await this.toastController.create({ message, duration: 2000, color, position: 'top' });
    await toast.present();
  }
}