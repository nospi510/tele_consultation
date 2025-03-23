import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { DoctorDashboardPage } from './doctor-dashboard.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    RouterModule.forChild([{ path: '', component: DoctorDashboardPage }]),
    DoctorDashboardPage // Import standalone component
  ]
})
export class DoctorDashboardPageModule {}