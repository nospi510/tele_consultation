import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { DoctorDashboardPage } from './doctor-dashboard.page';

const routes: Routes = [
  {
    path: '',
    component: DoctorDashboardPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class DoctorDashboardPageRoutingModule {}
