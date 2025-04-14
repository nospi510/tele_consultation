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
  selector: 'app-consultation-detail',
  templateUrl: './consultation-detail.page.html',
  styleUrls: ['./consultation-detail.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
})
export class ConsultationDetailPage implements OnInit, OnDestroy {
  consultation: any = {};
  newMessage: string = '';
  messages: { sender: string; text: string; timestamp: Date }[] = [];
  isDoctorTyping: boolean = false;
  callProposed: boolean = false;
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
    if (!this.authService.isLoggedIn()) {
      this.goToLogin();
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
    this.http.get(`${environment.apiUrl}/consultation/${id}`, { headers }).subscribe(
      (data: any) => {
        this.consultation = data;
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
      if (data.diagnosis && data.diagnosis !== this.consultation.diagnosis) {
        this.consultation.diagnosis = data.diagnosis;
        this.showToast('Nouveau diagnostic reçu', 'success');
      }
      this.checkMessageSync(data.conversation_history);
      this.updateMessages(this.consultation.conversation_history);
    });
    this.socket.on('typing_update', (data: any) => {
      this.isDoctorTyping = data.user_role === 'doctor' && data.is_typing;
    });
    this.socket.on('call_proposed', (data: any) => {
      console.log('Patient - Appel proposé par le médecin:', data);
      this.callProposed = true;
      this.showToast('Le médecin propose un appel vidéo', 'primary');
    });
    this.socket.on('webrtc_offer', (data: any) => this.handleOffer(data));
    this.socket.on('webrtc_answer', (data: any) => this.handleAnswer(data));
    this.socket.on('webrtc_ice_candidate', (data: any) => this.handleIceCandidate(data));
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
        return {
          sender: sender.trim(),
          text: textParts.join(': ').trim(),
          timestamp: new Date()
        };
      });
    this.messages = newMessages.filter((msg, index, self) =>
      index === self.findIndex(m => m.sender === msg.sender && m.text === msg.text)
    );
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
      this.socket.emit('typing', { consultation_id: id, user_role: 'patient', is_typing: !!this.newMessage });
    }
  }

  continueConsultation() {
    if (!this.newMessage || !this.consultation.id || this.consultation.status === 'terminée') return;

    const token = this.authService.getToken();
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
    const messageToSend = this.newMessage;
    const timestamp = new Date();

    this.messages.push({ sender: 'Patient', text: messageToSend, timestamp });
    this.newMessage = '';
    this.socket.emit('typing', { consultation_id: this.consultation.id, user_role: 'patient', is_typing: false });

    this.http.post(`${environment.apiUrl}/consultation/continue/${this.consultation.id}`, { message: messageToSend }, { headers }).subscribe(
      () => this.showToast('Message envoyé', 'success'),
      (error) => {
        console.error('Erreur envoi:', error);
        this.showToast('Erreur envoi', 'danger');
      }
    );
  }

  async joinCall() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id && this.callProposed && !this.inCall) {
      console.log('Patient - Rejoindre l’appel pour consultation:', id);
      this.inCall = true;
      this.callProposed = false;
      await this.initializeWebRTC();
      this.socket.emit('join_call', { consultation_id: id, user_id: this.authService.getUserId() });
    }
  }

  async initializeWebRTC() {
    try {
      const userId = this.authService.getUserId();
      if (!userId) throw new Error('User ID non disponible');

      this.peer = new Peer(`patient-${userId}-${this.consultation.id}`, {
        host: 'localhost',
        port: 9001,
        path: '/',
        debug: 3
      });

      this.peer.on('open', () => {
        console.log('Patient - PeerJS connecté:', this.peer!.id);
      });

      this.peer.on('error', (err) => {
        console.error('Patient - Erreur PeerJS:', err);
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
        console.log('Patient - Flux distant reçu:', event.streams[0]);
        this.remoteVideo.nativeElement.srcObject = event.streams[0];
      };

      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          console.log('Patient - Envoi ICE candidate');
          this.socket.emit('webrtc_ice_candidate', {
            consultation_id: this.consultation.id,
            candidate: event.candidate
          });
        }
      };

      this.peerConnection.onconnectionstatechange = () => {
        console.log('Patient - État connexion:', this.peerConnection!.connectionState);
        if (this.peerConnection!.connectionState === 'connected') {
          this.showToast('Appel connecté', 'success');
        } else if (this.peerConnection!.connectionState === 'failed') {
          this.showToast('Échec connexion appel', 'danger');
          this.endCall();
        }
      };
    } catch (error) {
      console.error('Patient - Erreur WebRTC:', error);
      this.showToast('Erreur lors de l’initialisation de l’appel', 'danger');
      this.endCall();
    }
  }

  async handleOffer(data: any) {
    try {
      console.log('Patient - Réception offre:', data.sdp);
      await this.peerConnection!.setRemoteDescription(new RTCSessionDescription(data.sdp));
      const answer = await this.peerConnection!.createAnswer();
      await this.peerConnection!.setLocalDescription(answer);
      console.log('Patient - Envoi réponse');
      this.socket.emit('webrtc_answer', {
        consultation_id: this.consultation.id,
        sdp: answer
      });
    } catch (error) {
      console.error('Patient - Erreur traitement offre:', error);
      this.showToast('Erreur traitement offre', 'danger');
    }
  }

  async handleAnswer(data: any) {
    try {
      console.log('Patient - Réception réponse:', data.sdp);
      await this.peerConnection!.setRemoteDescription(new RTCSessionDescription(data.sdp));
    } catch (error) {
      console.error('Patient - Erreur traitement réponse:', error);
      this.showToast('Erreur traitement réponse', 'danger');
    }
  }

  async handleIceCandidate(data: any) {
    try {
      console.log('Patient - Réception ICE candidate');
      await this.peerConnection!.addIceCandidate(new RTCIceCandidate(data.candidate));
    } catch (error) {
      console.error('Patient - Erreur ajout ICE candidate:', error);
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
    this.callProposed = false;
    this.localVideo.nativeElement.srcObject = null;
    this.remoteVideo.nativeElement.srcObject = null;
  }

  goToHome() {
    this.router.navigate(['/consultation-history']);
  }

  goToLogin() {
    this.router.navigate(['/login']);
  }

  async showToast(message: string, color: string) {
    const toast = await this.toastController.create({ message, duration: 2000, color, position: 'top' });
    await toast.present();
  }
}