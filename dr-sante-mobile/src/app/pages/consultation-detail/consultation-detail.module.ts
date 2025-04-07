import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { RouterModule } from '@angular/router';
import { ConsultationDetailPage } from './consultation-detail.page';

@NgModule({
  imports: [
    CommonModule,
    IonicModule,
    RouterModule.forChild([{ path: '', component: ConsultationDetailPage }]),
    ConsultationDetailPage
  ]
})
export class ConsultationDetailPageModule {}