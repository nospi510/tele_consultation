import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { LiveSessionPage } from './live-session.page';

const routes: Routes = [
  {
    path: '',
    component: LiveSessionPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class LiveSessionPageRoutingModule {}
