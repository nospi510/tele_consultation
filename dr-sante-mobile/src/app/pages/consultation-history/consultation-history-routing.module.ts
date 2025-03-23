import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { ConsultationHistoryPage } from './consultation-history.page';

const routes: Routes = [
  {
    path: '',
    component: ConsultationHistoryPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ConsultationHistoryPageRoutingModule {}
