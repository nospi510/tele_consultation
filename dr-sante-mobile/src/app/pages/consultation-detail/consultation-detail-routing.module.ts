import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { ConsultationDetailPage } from './consultation-detail.page';

const routes: Routes = [
  {
    path: '',
    component: ConsultationDetailPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ConsultationDetailPageRoutingModule {}
