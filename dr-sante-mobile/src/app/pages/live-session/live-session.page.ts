import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { io } from 'socket.io-client';
import * as SimplePeer from 'simple-peer';

@Component({
  selector: 'app-live-session',
  templateUrl: './live-session.page.html',
  styleUrls: ['./live-session.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
})
export class LiveSessionPage implements OnInit {
  @ViewChild('videoElement', { static: false }) videoElement!: ElementRef;
  sessionId!: number;
  socket: any;
  peer: any;
  comments: any[] = [];
  newComment: string = '';
  stream: MediaStream | undefined;

  constructor(
    private route: ActivatedRoute,
    private http: HttpClient,
    public authService: AuthService 
  ) {
    this.socket = io(`${environment.apiUrl}`, { path: '/live' });
  }

  ngOnInit() {
    this.sessionId = +this.route.snapshot.paramMap.get('id')!;
    this.joinSession();

    this.socket.on('new_comment', (data: any) => {
      this.comments.push(data);
    });

    this.socket.on('broadcast_started', (data: any) => {
      if (this.authService.isDoctor()) this.startBroadcast();
    });

    if (this.authService.isDoctor()) {
      this.setupBroadcaster();
    } else {
      this.setupViewer();
    }
  }
  startBroadcast() {
    throw new Error('Method not implemented.');
  }

  joinSession() {
    this.socket.emit('join_session', {
      session_id: this.sessionId,
      user_id: this.authService.getUserId()
    });
  }

  setupBroadcaster() {
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(stream => {
        this.stream = stream;
        this.videoElement.nativeElement.srcObject = stream;
        this.peer = new SimplePeer({ initiator: true, stream: stream });
        
        this.peer.on('signal', (data: any) => {
          this.socket.emit('start_broadcast', {
            session_id: this.sessionId,
            user_id: this.authService.getUserId()
          });
        });

        this.peer.on('stream', (remoteStream: MediaStream) => {
          this.videoElement.nativeElement.srcObject = remoteStream;
        });
      });
  }

  setupViewer() {
    this.peer = new SimplePeer();
    this.peer.on('stream', (stream: MediaStream) => {
      this.videoElement.nativeElement.srcObject = stream;
    });
  }

  joinAsBroadcaster() {
    this.http.post(`${environment.apiUrl}/tnt/live-session/join-as-broadcaster`, 
      { session_id: this.sessionId }, 
      { headers: { Authorization: `Bearer ${this.authService.getToken()}` } }
    ).subscribe(() => {
      this.setupBroadcaster();
    });
  }

  sendComment() {
    if (this.newComment) {
      this.socket.emit('send_comment', {
        session_id: this.sessionId,
        user_id: this.authService.getUserId(),
        comment: this.newComment
      });
      this.newComment = '';
    }
  }

  ngOnDestroy() {
    this.socket.emit('leave_session', {
      session_id: this.sessionId,
      user_id: this.authService.getUserId()
    });
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
    }
    if (this.peer) {
      this.peer.destroy();
    }
  }
}