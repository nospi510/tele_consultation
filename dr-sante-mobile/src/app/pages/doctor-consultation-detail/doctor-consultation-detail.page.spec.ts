import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DoctorConsultationDetailPage } from './doctor-consultation-detail.page';

describe('DoctorConsultationDetailPage', () => {
  let component: DoctorConsultationDetailPage;
  let fixture: ComponentFixture<DoctorConsultationDetailPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(DoctorConsultationDetailPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
