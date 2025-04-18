import { Component, OnInit, ViewChild, ElementRef, OnDestroy, AfterViewInit } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { io } from 'socket.io-client';
import Peer from 'peerjs';
import { AuthService } from '../../services/auth.service';
import Hls from 'hls.js';

@Component({
  selector: 'app-live-session',
  templateUrl: './live-session.page.html',
  styleUrls: ['./live-session.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
})
export class LiveSessionPage implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('localVideo', { static: false }) localVideo!: ElementRef<HTMLVideoElement>;
  @ViewChild('hlsVideo', { static: false }) hlsVideo!: ElementRef<HTMLVideoElement>;
  sessionId: number;
  sessionTitle: string = '';
  broadcasters: string[] = [];
  hlsStreams: { user_id: string; hls_url: string }[] = [];
  comments: { id: string; user: string; comment: string; timestamp: string }[] = [];
  newComment: string = '';
  isDoctor: boolean = false;
  isBroadcaster: boolean = false;
  isBroadcasting: boolean = false;
  isTyping: boolean = false;
  private socket: any;
  private peer: Peer;
  private localStream: MediaStream | null = null;
  private peers: { [key: string]: any } = {};
  private hlsPlayers: Hls[] = [];
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
    this.loadHlsStreams();
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

  ngAfterViewInit() {
    this.loadHlsPlayers();
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
          this.hlsStreams = session.hls_urls.map((url: string, index: number) => ({
            user_id: session.broadcasters[index] || 'unknown',
            hls_url: url
          }));
          this.isBroadcaster = this.broadcasters.includes(this.authService.getUserId()!);
          this.loadHlsPlayers();
        }
      },
      error: (err) => console.error('Erreur chargement session:', err)
    });
  }

  loadHlsStreams() {
    const token = this.authService.getToken();
    this.http.get(`${environment.apiUrl}/tnt/live-session/${this.sessionId}/url`, {
      headers: new HttpHeaders({ Authorization: `Bearer ${token}` })
    }).subscribe({
      next: (data: any) => {
        this.hlsStreams = data;
        this.loadHlsPlayers();
      },
      error: (err) => console.error('Erreur chargement URLs HLS:', err)
    });
  }

  loadHlsPlayers() {
    this.hlsStreams.forEach((stream, index) => {
      const videoElement = document.querySelectorAll('video.live-video')[index] as HTMLVideoElement;
      if (videoElement && Hls.isSupported()) {
        const hls = new Hls();
        hls.loadSource(stream.hls_url);
        hls.attachMedia(videoElement);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          videoElement.play().catch(err => console.error('Erreur lecture HLS:', err));
        });
        this.hlsPlayers.push(hls);
      } else if (videoElement) {
        videoElement.src = stream.hls_url;
        videoElement.play().catch(err => console.error('Erreur lecture directe:', err));
      }
    });
  }

  setupSocketListeners() {
    this.socket.on('connect', () => console.log('WebSocket connecté'));
    this.socket.on('broadcast_started', (data: any) => {
      console.log('Diffusion démarrée par:', data.user_id);
      this.hlsStreams.push({ user_id: data.user_id, hls_url: data.hls_url });
      this.loadHlsPlayers();
    });
    this.socket.on('broadcaster_joined', (data: any) => {
      console.log('Nouveau diffuseur:', data.user);
      this.broadcasters.push(data.user);
      this.loadHlsStreams();
    });
    this.socket.on('new_comment', (data: any) => {
      if (!this.comments.some(c => c.id === data.id)) {
        this.comments.push(data);
      }
    });
    this.socket.on('typing', (data: any) => {
      this.isTyping = data.is_typing;
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
        next: () => {
          console.log('URL HLS stockée:', hlsUrl);
          this.socket.emit('start_broadcast', { session_id: this.sessionId, user_id: userId, hls_url: hlsUrl });
        },
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

  handleIncomingCall(call: any) {
    console.log('Appel entrant de:', call.peer);
    call.answer(this.localStream || new MediaStream());
    call.on('stream', (remoteStream: MediaStream) => {
      console.log('Flux entrant reçu de:', call.peer);
    });
    call.on('error', (err: any) => console.error('Erreur appel entrant:', err));
    this.peers[call.peer] = call;
  }

  onTyping(event: any) {
    const userId = this.authService.getUserId();
    this.socket.emit('typing', { session_id: this.sessionId, user_id: userId, is_typing: !!this.newComment });
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
      this.socket.emit('typing', { session_id: this.sessionId, user_id: userId, is_typing: false });
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
    this.hlsPlayers.forEach(hls => hls.destroy());
    this.peer.destroy();
    this.socket.disconnect();
  }
}