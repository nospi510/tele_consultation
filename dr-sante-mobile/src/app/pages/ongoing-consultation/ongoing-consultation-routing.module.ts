import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { OngoingConsultationPage } from './ongoing-consultation.page';

const routes: Routes = [
  {
    path: '',
    component: OngoingConsultationPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class OngoingConsultationPageRoutingModule {}
