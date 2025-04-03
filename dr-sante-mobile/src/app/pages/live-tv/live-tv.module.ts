import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { LiveTvPage } from './live-tv.page'; // Importe le composant standalone

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    RouterModule.forChild([{ path: '', component: LiveTvPage }]), // Route interne au module
    LiveTvPage // Importe le composant standalone ici, pas dans declarations
  ]
})
export class LiveTvPageModule {}