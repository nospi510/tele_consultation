import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { DoctorUpcomingAppointmentsPage } from './doctor-upcoming-appointments.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    RouterModule.forChild([{ path: '', component: DoctorUpcomingAppointmentsPage }]),
    DoctorUpcomingAppointmentsPage // Import standalone component
  ]
})
export class DoctorUpcomingAppointmentsPageModule {}