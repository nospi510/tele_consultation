import { Injectable } from '@angular/core';
import { Socket } from 'ngx-socket-io';
import { environment } from '../../environments/environment';


@Injectable({
  providedIn: 'root'
})
export class SocketService {
  consultationSocket: Socket;

  constructor() {
    this.consultationSocket = new Socket({
      url: `${environment.apiUrl}/consultation`, 
      options: {}
    });
  }

  getConsultationSocket(): Socket {
    return this.consultationSocket;
  }
}