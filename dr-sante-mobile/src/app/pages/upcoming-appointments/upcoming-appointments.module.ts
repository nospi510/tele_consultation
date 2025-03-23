import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { RouterModule } from '@angular/router';
import { UpcomingAppointmentsPage } from './upcoming-appointments.page';

@NgModule({
  imports: [
    CommonModule,
    IonicModule,
    RouterModule.forChild([{ path: '', component: UpcomingAppointmentsPage }]),
    UpcomingAppointmentsPage
  ]
})
export class UpcomingAppointmentsPageModule {}