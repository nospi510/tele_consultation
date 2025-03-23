import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DoctorConsultationsPage } from './doctor-consultations.page';

describe('DoctorConsultationsPage', () => {
  let component: DoctorConsultationsPage;
  let fixture: ComponentFixture<DoctorConsultationsPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(DoctorConsultationsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
