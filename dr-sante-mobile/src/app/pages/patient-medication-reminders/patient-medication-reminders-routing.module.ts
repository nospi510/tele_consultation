import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { PatientMedicationRemindersPage } from './patient-medication-reminders.page';

const routes: Routes = [
  {
    path: '',
    component: PatientMedicationRemindersPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class PatientMedicationRemindersPageRoutingModule {}
