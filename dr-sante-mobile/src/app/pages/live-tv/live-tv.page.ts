import { Component, OnInit, ViewChild, ElementRef, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import videojs from 'video.js';

@Component({
  selector: 'app-live-tv',
  templateUrl: './live-tv.page.html',
  styleUrls: ['./live-tv.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule]
})
export class LiveTvPage implements OnInit, OnDestroy {
  @ViewChild('videoPlayer', { static: false }) videoPlayer!: ElementRef<HTMLVideoElement>;
  channels: { name: string; url: string }[] = [];
  selectedChannel: { name: string; url: string } | null = null;
  loading: boolean = true;
  error: string | null = null;
  channelsOpen: boolean = false;
  private player: any = null;

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.loadChannels();
  }

  loadChannels() {
    this.loading = true;
    this.error = null;
    this.http.get(`${environment.apiUrl}/tnt/live-channels`).subscribe({
      next: (data: any) => {
        this.channels = data;
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Erreur lors du chargement des chaînes.';
        this.loading = false;
        console.error('Erreur HTTP:', err);
      }
    });
  }

  toggleChannels() {
    this.channelsOpen = !this.channelsOpen;
  }

  playChannel(channel: { name: string; url: string }) {
    this.selectedChannel = channel;

    if (this.player) {
      this.player.dispose();
      this.player = null;
    }

    setTimeout(() => {
      if (this.videoPlayer && this.videoPlayer.nativeElement) {
        this.initializePlayer(this.getProxyUrl(channel.url));
      } else {
        console.error('Video player element not found');
        this.error = 'Élément vidéo introuvable.';
      }
    }, 100);
  }

  private getProxyUrl(originalUrl: string): string {
    const encodedUrl = encodeURIComponent(originalUrl);
    return `${environment.apiUrl}/tnt/live-channels/proxy/${encodedUrl}`;
  }

  private initializePlayer(url: string) {
    const videoElement = this.videoPlayer.nativeElement;
    videoElement.style.display = 'block';

    this.player = videojs(videoElement, {
      controls: true,
      autoplay: true,
      fluid: false, // Désactiver fluid pour respecter les dimensions du conteneur
      width: '100%',
      height: '100%',
      sources: [{
        src: url,
        type: 'application/x-mpegURL'
      }],
      html5: {
        hls: {
          overrideNative: true
        }
      }
    }, () => {
      console.log('Player initialized successfully');
    });

    this.player.on('error', () => {
      console.error('Erreur de lecture:', this.player.error());
      this.error = 'Erreur : ' + (this.player.error()?.message || 'Inconnue');
    });

    this.player.on('loadedmetadata', () => {
      console.log('Métadonnées:', this.player.videoWidth(), this.player.videoHeight());
    });
  }

  ngOnDestroy() {
    if (this.player) {
      this.player.dispose();
      this.player = null;
    }
  }
}