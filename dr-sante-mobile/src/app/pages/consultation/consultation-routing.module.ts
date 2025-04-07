import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { ConsultationPage } from './consultation.page';

const routes: Routes = [
  {
    path: '',
    component: ConsultationPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ConsultationPageRoutingModule {}
