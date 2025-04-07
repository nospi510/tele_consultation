import { Component } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';
import { IonicModule, ToastController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
})
export class LoginPage {
  email: string = '';
  password: string = '';

  constructor(
    private authService: AuthService,
    private router: Router,
    private toastController: ToastController
  ) {}

  async login() {
    try {
      const response = await this.authService.login(this.email, this.password).toPromise();
      console.log('Réponse complète du backend:', response); // Débogage détaillé

      // Vérifie que le token et le rôle sont bien stockés
      console.log('Token stocké:', localStorage.getItem('token'));
      console.log('Rôle stocké:', localStorage.getItem('user_role'));
      console.log('ID utilisateur stocké:', localStorage.getItem('user_id'));

      const role = this.authService.getUserRole();
      console.log('Rôle récupéré après connexion :', role);

      if (role === 'doctor') {
        this.router.navigate(['/doctor-dashboard']);
      } else if (role === 'patient') {
        this.router.navigate(['/home']);
      } else {
        console.log('Rôle inconnu ou non défini, redirection par défaut vers /home');
        this.router.navigate(['/home']);
      }
    } catch (error) {
      console.error('Erreur de connexion:', error);
      const toast = await this.toastController.create({
        message: 'Erreur de connexion : identifiants invalides',
        duration: 2000,
        color: 'danger'
      });
      toast.present();
    }
  }

  goToRegister() {
    this.router.navigate(['/register']);
  }
}