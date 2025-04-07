import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DoctorGenerateReportPage } from './doctor-generate-report.page';

describe('DoctorGenerateReportPage', () => {
  let component: DoctorGenerateReportPage;
  let fixture: ComponentFixture<DoctorGenerateReportPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(DoctorGenerateReportPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
