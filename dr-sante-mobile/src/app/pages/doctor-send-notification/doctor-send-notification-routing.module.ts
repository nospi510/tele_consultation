import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { DoctorSendNotificationPage } from './doctor-send-notification.page';

const routes: Routes = [
  {
    path: '',
    component: DoctorSendNotificationPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class DoctorSendNotificationPageRoutingModule {}
