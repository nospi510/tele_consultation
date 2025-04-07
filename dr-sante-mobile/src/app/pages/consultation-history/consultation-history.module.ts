import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { RouterModule } from '@angular/router';
import { ConsultationHistoryPage } from './consultation-history.page';

@NgModule({
  imports: [
    CommonModule,
    IonicModule,
    RouterModule.forChild([{ path: '', component: ConsultationHistoryPage }]),
    ConsultationHistoryPage
  ]
})
export class ConsultationHistoryPageModule {}