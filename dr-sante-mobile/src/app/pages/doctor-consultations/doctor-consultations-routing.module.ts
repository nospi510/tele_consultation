import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { DoctorConsultationsPage } from './doctor-consultations.page';

const routes: Routes = [
  {
    path: '',
    component: DoctorConsultationsPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class DoctorConsultationsPageRoutingModule {}
