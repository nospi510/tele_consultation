import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { DoctorHealthAlertsPage } from './doctor-health-alerts.page';

const routes: Routes = [
  {
    path: '',
    component: DoctorHealthAlertsPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class DoctorHealthAlertsPageRoutingModule {}
