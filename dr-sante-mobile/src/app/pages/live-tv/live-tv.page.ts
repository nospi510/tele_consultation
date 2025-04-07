import { Component, OnInit, ViewChild, ElementRef, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { VideoPlayerService } from '../../services/video-player.service';

// @ts-ignore
import Hls from 'hls.js';
import { NavigationStart, Router } from '@angular/router';


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
  private hls: Hls | null = null;

  constructor(
    private http: HttpClient,
    private router: Router,
    private videoPlayerService: VideoPlayerService
  ) {
    // Écouter les changements de navigation
    this.router.events.subscribe(event => {
      if (event instanceof NavigationStart && this.videoPlayerService.isPlaying()) {
        if (event.url !== '/live-tv') {
          this.videoPlayerService.moveToMiniature();
        }
      }
    });
  }

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

    if (this.hls) {
      this.hls.destroy();
      this.hls = null;
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

    if (Hls.isSupported()) {
      this.hls = new Hls({
        debug: true,
        maxBufferLength: 60,
        maxMaxBufferLength: 120,
        liveSyncDurationCount: 3,
        manifestLoadingTimeOut: 20000,
        levelLoadingTimeOut: 20000,
        fragLoadingTimeOut: 20000,
        manifestLoadingMaxRetry: 3,
        levelLoadingMaxRetry: 3,
        fragLoadingMaxRetry: 3
      });

      this.hls.loadSource(url);
      this.hls.attachMedia(videoElement);

      this.hls.on(Hls.Events.MANIFEST_PARSED, () => {
        videoElement.play().catch(err => {
          console.error('Erreur de lecture:', err);
          this.error = 'Erreur de lecture du flux.';
        });
      });

      this.hls.on(Hls.Events.ERROR, (event, data) => {
        console.error('Erreur HLS:', data);
        if (data.fatal) {
          this.error = `Erreur fatale HLS: ${data.details}`;
          this.hls?.destroy();
          this.hls = null;
          if (data.details === 'manifestLoadError' && data.response?.code === 500) {
            setTimeout(() => this.initializePlayer(url), 2000);
          }
        } else {
          console.warn('Erreur non fatale ignorée:', data.details);
        }
      });

      // Enregistrer le player dans le service
      this.videoPlayerService.setPlayer(this.hls, videoElement);
    } else if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
      videoElement.src = url;
      videoElement.play().catch(err => {
        console.error('Erreur de lecture native:', err);
        this.error = 'Erreur de lecture native.';
      });
      this.videoPlayerService.setPlayer(null, videoElement);
    } else {
      this.error = 'HLS non supporté par cet appareil.';
    }
  }
  ngOnDestroy() {
    if (this.hls) {
      this.hls.destroy();
      this.hls = null;
    }
    if (this.videoPlayer && this.videoPlayer.nativeElement) {
      this.videoPlayer.nativeElement.pause();
      this.videoPlayer.nativeElement.src = '';
    }
  }
}