import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ConsultationRatePage } from './consultation-rate.page';

describe('ConsultationRatePage', () => {
  let component: ConsultationRatePage;
  let fixture: ComponentFixture<ConsultationRatePage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(ConsultationRatePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
