import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { DoctorSendNotificationPage } from './doctor-send-notification.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    RouterModule.forChild([{ path: '', component: DoctorSendNotificationPage }]),
    DoctorSendNotificationPage // Import standalone component
  ]
})
export class DoctorSendNotificationPageModule {}