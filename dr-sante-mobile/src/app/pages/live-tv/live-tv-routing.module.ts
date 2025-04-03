import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { LiveTvPage } from './live-tv.page';

const routes: Routes = [
  {
    path: '',
    component: LiveTvPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class LiveTvPageRoutingModule {}
