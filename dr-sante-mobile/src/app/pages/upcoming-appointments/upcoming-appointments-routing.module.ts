import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { UpcomingAppointmentsPage } from './upcoming-appointments.page';

const routes: Routes = [
  {
    path: '',
    component: UpcomingAppointmentsPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class UpcomingAppointmentsPageRoutingModule {}
