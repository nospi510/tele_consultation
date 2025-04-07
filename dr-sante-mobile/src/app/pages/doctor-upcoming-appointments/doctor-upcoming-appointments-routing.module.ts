import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { DoctorUpcomingAppointmentsPage } from './doctor-upcoming-appointments.page';

const routes: Routes = [
  {
    path: '',
    component: DoctorUpcomingAppointmentsPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class DoctorUpcomingAppointmentsPageRoutingModule {}
