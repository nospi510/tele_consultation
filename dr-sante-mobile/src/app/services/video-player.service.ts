import { Injectable } from '@angular/core';
import Hls from 'hls.js';

@Injectable({
  providedIn: 'root'
})
export class VideoPlayerService {
  private hls: Hls | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private isMiniature: boolean = false;
  private container: HTMLElement | null = null;

  setPlayer(hls: Hls | null, videoElement: HTMLVideoElement) {
    this.hls = hls;
    this.videoElement = videoElement;
  }

  clearPlayer() {
    if (this.hls) {
      this.hls.destroy();
      this.hls = null;
    }
    if (this.videoElement) {
      this.videoElement.pause();
      this.videoElement.src = '';
    }
    this.videoElement = null;
    this.isMiniature = false;
    this.removeMiniature();
  }

  moveToMiniature() {
    if (!this.videoElement || this.isMiniature) return;

    // Créer un conteneur pour la miniature
    this.container = document.createElement('div');
    this.container.className = 'video-miniature';
    const closeButton = document.createElement('button');
    closeButton.innerHTML = '✖';
    closeButton.className = 'close-miniature';
    closeButton.onclick = () => this.clearPlayer();

    // Ajouter la vidéo et le bouton au conteneur
    this.videoElement.style.width = '200px';
    this.videoElement.style.height = 'auto';
    this.container.appendChild(this.videoElement);
    this.container.appendChild(closeButton);
    document.body.appendChild(this.container);

    this.isMiniature = true;
  }

  restoreFromMiniature(parentElement: HTMLElement) {
    if (!this.isMiniature || !this.videoElement || !this.container) return;

    parentElement.appendChild(this.videoElement);
    this.videoElement.style.width = '100%';
    this.videoElement.style.height = '100%';
    document.body.removeChild(this.container);
    this.container = null;
    this.isMiniature = false;
  }

  private removeMiniature() {
    if (this.container && document.body.contains(this.container)) {
      document.body.removeChild(this.container);
      this.container = null;
    }
  }

  isPlaying(): boolean {
    return !!this.hls && !!this.videoElement && !this.videoElement.paused;
  }
}