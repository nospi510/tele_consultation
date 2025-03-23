import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { ScheduleAppointmentPage } from './schedule-appointment.page';

const routes: Routes = [
  {
    path: '',
    component: ScheduleAppointmentPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ScheduleAppointmentPageRoutingModule {}
