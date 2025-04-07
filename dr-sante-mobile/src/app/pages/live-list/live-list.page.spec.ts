import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LiveListPage } from './live-list.page';

describe('LiveListPage', () => {
  let component: LiveListPage;
  let fixture: ComponentFixture<LiveListPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(LiveListPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
