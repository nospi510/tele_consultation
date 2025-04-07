import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { DoctorGenerateReportPage } from './doctor-generate-report.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    RouterModule.forChild([{ path: '', component: DoctorGenerateReportPage }]),
    DoctorGenerateReportPage // Import standalone component
  ]
})
export class DoctorGenerateReportPageModule {}