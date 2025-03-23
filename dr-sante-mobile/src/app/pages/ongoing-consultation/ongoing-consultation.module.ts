import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { OngoingConsultationPageRoutingModule } from './ongoing-consultation-routing.module';

import { OngoingConsultationPage } from './ongoing-consultation.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    OngoingConsultationPageRoutingModule
  ],
  declarations: [OngoingConsultationPage]
})
export class OngoingConsultationPageModule {}
