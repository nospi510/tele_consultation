import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { DoctorHealthAlertsPage } from './doctor-health-alerts.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    RouterModule.forChild([{ path: '', component: DoctorHealthAlertsPage }]),
    DoctorHealthAlertsPage // Import standalone component
  ]
})
export class DoctorHealthAlertsPageModule {}