import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { ConsultationRatePage } from './consultation-rate.page';

const routes: Routes = [
  {
    path: '',
    component: ConsultationRatePage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ConsultationRatePageRoutingModule {}
