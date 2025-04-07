import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { DoctorConsultationDetailPage } from './doctor-consultation-detail.page';

const routes: Routes = [
  {
    path: '',
    component: DoctorConsultationDetailPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class DoctorConsultationDetailPageRoutingModule {}
