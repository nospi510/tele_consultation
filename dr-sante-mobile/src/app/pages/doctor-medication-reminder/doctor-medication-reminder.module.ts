import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { DoctorMedicationReminderPage } from './doctor-medication-reminder.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    RouterModule.forChild([{ path: '', component: DoctorMedicationReminderPage }]),
    DoctorMedicationReminderPage // Import standalone component
  ]
})
export class DoctorMedicationReminderPageModule {}