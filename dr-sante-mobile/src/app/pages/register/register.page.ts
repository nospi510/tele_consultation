import { Component } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';
import { IonicModule, ToastController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-register',
  templateUrl: './register.page.html',
  styleUrls: ['./register.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
})
export class RegisterPage {
  fullname: string = '';
  email: string = '';
  password: string = '';

  constructor(
    private authService: AuthService,
    private router: Router,
    private toastController: ToastController
  ) {}

  async register() {
    try {
      await this.authService.register(this.fullname, this.email, this.password).toPromise();
      const toast = await this.toastController.create({
        message: 'Inscription réussie ! Connectez-vous.',
        duration: 2000,
        color: 'success'
      });
      toast.present();
      this.router.navigate(['/login']);
    } catch (error) {
      const toast = await this.toastController.create({
        message: 'Erreur lors de l’inscription',
        duration: 2000,
        color: 'danger'
      });
      toast.present();
    }
  }
  goToLogin() {
    this.router.navigate(['/login']);
  }
}