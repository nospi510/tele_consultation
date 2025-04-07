import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { RouterModule } from '@angular/router';
import { PatientMedicationRemindersPage } from './patient-medication-reminders.page';

@NgModule({
  imports: [
    CommonModule,
    IonicModule,
    RouterModule.forChild([{ path: '', component: PatientMedicationRemindersPage }]),
    PatientMedicationRemindersPage // Import standalone component
  ]
})
export class PatientMedicationRemindersPageModule {}