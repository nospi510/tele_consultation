import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { DoctorMedicationReminderPage } from './doctor-medication-reminder.page';

const routes: Routes = [
  {
    path: '',
    component: DoctorMedicationReminderPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class DoctorMedicationReminderPageRoutingModule {}
