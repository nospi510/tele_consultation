import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DoctorDashboardPage } from './doctor-dashboard.page';

describe('DoctorDashboardPage', () => {
  let component: DoctorDashboardPage;
  let fixture: ComponentFixture<DoctorDashboardPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(DoctorDashboardPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
