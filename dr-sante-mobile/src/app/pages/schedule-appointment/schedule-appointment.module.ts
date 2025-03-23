import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ScheduleAppointmentPage } from './schedule-appointment.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    RouterModule.forChild([{ path: '', component: ScheduleAppointmentPage }]),
    ScheduleAppointmentPage
  ]
})
export class ScheduleAppointmentPageModule {}