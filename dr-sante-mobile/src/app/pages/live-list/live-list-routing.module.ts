import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { LiveListPage } from './live-list.page';

const routes: Routes = [
  {
    path: '',
    component: LiveListPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class LiveListPageRoutingModule {}
