import { Component, OnInit, ViewChild, ElementRef, OnDestroy } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { io } from 'socket.io-client';
import Peer from 'peerjs';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-live-session',
  templateUrl: './live-session.page.html',
  styleUrls: ['./live-session.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
})
export class LiveSessionPage implements OnInit, OnDestroy {
  @ViewChild('localVideo', { static: false }) localVideo!: ElementRef<HTMLVideoElement>;
  sessionId: number;
  sessionTitle: string = '';
  broadcasters: string[] = [];
  remoteStreams: MediaStream[] = [];
  comments: { user: string; comment: string; timestamp: string }[] = [];
  newComment: string = '';
  isDoctor: boolean = false;
  isBroadcaster: boolean = false;
  isBroadcasting: boolean = false;
  private socket: any;
  private peer: Peer;
  private localStream: MediaStream | null = null;
  private peers: { [key: string]: any } = {};
  private peerStreamMap: { [peerId: string]: MediaStream } = {};
  private rtcPeerConnection: RTCPeerConnection | null = null;

  constructor(
    private http: HttpClient,
    private route: ActivatedRoute,
    private authService: AuthService,
    private router: Router
  ) {
    this.sessionId = +this.route.snapshot.paramMap.get('id')!;
    this.socket = io(`${environment.apiUrl}/live`, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000
    });
    const userId = this.authService.getUserId() || 'unknown';
    this.peer = new Peer(userId, {
      host: 'localhost',
      port: 9001,
      path: '/',
      debug: 3
    });
  }

  ngOnInit() {
    this.isDoctor = this.authService.isDoctor();
    this.loadSessionDetails();
    this.setupSocketListeners();
    this.joinSession();

    this.peer.on('open', (id) => {
      console.log('Peer ID ouvert:', id);
    });
    this.peer.on('call', (call) => this.handleIncomingCall(call));
    this.peer.on('error', (err) => console.error('Erreur PeerJS:', err));
    this.peer.on('disconnected', () => {
      console.log('PeerJS déconnecté, tentative de reconnexion...');
      this.peer.reconnect();
    });
  }

  loadSessionDetails() {
    const token = this.authService.getToken();
    this.http.get(`${environment.apiUrl}/tnt/live-session/list`, {
      headers: new HttpHeaders({ Authorization: `Bearer ${token}` })
    }).subscribe({
      next: (sessions: any) => {
        const session = sessions.find((s: any) => s.id === this.sessionId);
        if (session) {
          this.sessionTitle = session.title;
          this.broadcasters = session.broadcasters;
          this.isBroadcaster = this.broadcasters.includes(this.authService.getUserId()!);
        }
      },
      error: (err) => console.error('Erreur chargement session:', err)
    });
  }

  setupSocketListeners() {
    this.socket.on('connect', () => console.log('WebSocket connecté'));
    this.socket.on('broadcast_started', (data: any) => {
      console.log('Diffusion démarrée par:', data.user_id);
    });
  }

  joinSession() {
    const userId = this.authService.getUserId();
    if (userId) {
      this.socket.emit('join_session', { session_id: this.sessionId, user_id: userId });
    }
  }

  joinAsBroadcaster() {
    const token = this.authService.getToken();
    this.http.post(`${environment.apiUrl}/tnt/live-session/join-as-broadcaster`, 
      { session_id: this.sessionId }, 
      { headers: new HttpHeaders({ Authorization: `Bearer ${token}` }) }
    ).subscribe({
      next: () => {
        this.isBroadcaster = true;
        this.startBroadcast();
      },
      error: (err) => console.error('Erreur join broadcaster:', err)
    });
  }

  async startBroadcast() {
    this.isBroadcasting = true;
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      this.localVideo.nativeElement.srcObject = this.localStream;
  
      const userId = this.authService.getUserId();
      console.log('Début diffusion:', userId);
      this.socket.emit('start_broadcast', { session_id: this.sessionId, user_id: userId });
  
      const hlsUrl = `http://localhost:8080/hls/live/${this.sessionId}_${userId}.m3u8`;
  
      this.rtcPeerConnection = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });
  
      this.localStream.getTracks().forEach(track => {
        this.rtcPeerConnection!.addTrack(track, this.localStream!);
      });
  
      this.rtcPeerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          console.log('ICE candidate:', event.candidate);
        } else {
          console.log('Fin des candidats ICE');
        }
      };
  
      this.rtcPeerConnection.onconnectionstatechange = () => {
        console.log('État connexion WebRTC:', this.rtcPeerConnection!.connectionState);
        if (this.rtcPeerConnection!.connectionState === 'connected') {
          console.log('WebRTC connecté avec succès');
        }
      };
  
      const offer = await this.rtcPeerConnection.createOffer();
      await this.rtcPeerConnection.setLocalDescription(offer);
      console.log('Offre SDP:', offer.sdp);
  
      const response = await fetch('http://localhost:1985/rtc/v1/publish/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sdp: offer.sdp,
          streamurl: `/live/${this.sessionId}_${userId}`
        })
      });
  
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erreur SRS WebRTC: ${response.status} - ${errorText}`);
      }
  
      const data = await response.json();
      console.log('Réponse SRS:', data);
      await this.rtcPeerConnection.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: data.sdp }));
  
      await new Promise(resolve => setTimeout(resolve, 5000));
  
      const token = this.authService.getToken();
      this.http.post(
        `${environment.apiUrl}/tnt/live-session/broadcast-url`,
        { session_id: this.sessionId, hls_url: hlsUrl },
        { headers: new HttpHeaders({ Authorization: `Bearer ${token}` }) }
      ).subscribe({
        next: () => console.log('URL HLS stockée:', hlsUrl),
        error: (err) => console.error('Erreur stockage URL HLS:', err)
      });
  
      this.http.post(
        `${environment.apiUrl}/tnt/live-session/start-broadcast`,
        { session_id: this.sessionId },
        { headers: new HttpHeaders({ Authorization: `Bearer ${token}` }) }
      ).subscribe({
        next: (response: any) => console.log('Backend notifié:', response.hls_url),
        error: (err) => console.error('Erreur notification backend:', err)
      });
    } catch (err) {
      console.error('Erreur démarrage diffusion:', err);
    }
  }

  connectToBroadcaster(broadcasterId: string) {
    if (broadcasterId === this.authService.getUserId()) return;
    console.log('Connexion au broadcaster:', broadcasterId);
    const call = this.peer.call(broadcasterId, new MediaStream());
    call.on('stream', (remoteStream: MediaStream) => {
      console.log('Flux reçu de:', broadcasterId);
      this.addRemoteStream(broadcasterId, remoteStream);
    });
    call.on('error', (err: any) => console.error('Erreur appel:', err));
    this.peers[broadcasterId] = call;
  }

  handleIncomingCall(call: any) {
    console.log('Appel entrant de:', call.peer);
    call.answer(this.localStream || new MediaStream());
    call.on('stream', (remoteStream: MediaStream) => {
      console.log('Flux entrant reçu de:', call.peer);
      this.addRemoteStream(call.peer, remoteStream);
    });
    call.on('error', (err: any) => console.error('Erreur appel entrant:', err));
    this.peers[call.peer] = call;
  }

  addRemoteStream(peerId: string, stream: MediaStream) {
    if (!this.peerStreamMap[peerId]) {
      this.peerStreamMap[peerId] = stream;
      this.remoteStreams = Object.values(this.peerStreamMap);
      console.log('Flux ajouté, total:', this.remoteStreams.length);
    }
  }

  sendComment() {
    if (this.newComment.trim()) {
      const userId = this.authService.getUserId();
      this.socket.emit('send_comment', {
        session_id: this.sessionId,
        user_id: userId,
        comment: this.newComment
      });
      this.newComment = '';
    }
  }

  goBack() {
    if (this.isDoctor) {
      this.router.navigate(['/doctor-dashboard']);
    } else {
      this.router.navigate(['/home']);
    }
  }

  ngOnDestroy() {
    const userId = this.authService.getUserId();
    this.socket.emit('leave_session', { session_id: this.sessionId, user_id: userId });
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
    }
    if (this.rtcPeerConnection) {
      this.rtcPeerConnection.close();
    }
    Object.values(this.peers).forEach(call => call.close());
    this.peer.destroy();
    this.socket.disconnect();
  }
}