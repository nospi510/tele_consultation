import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { DoctorConsultationDetailPage } from './doctor-consultation-detail.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    RouterModule.forChild([{ path: '', component: DoctorConsultationDetailPage }]),
    DoctorConsultationDetailPage // Import standalone component
  ]
})
export class DoctorConsultationDetailPageModule {}