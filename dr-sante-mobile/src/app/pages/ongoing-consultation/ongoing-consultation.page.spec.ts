import { ComponentFixture, TestBed } from '@angular/core/testing';
import { OngoingConsultationPage } from './ongoing-consultation.page';

describe('OngoingConsultationPage', () => {
  let component: OngoingConsultationPage;
  let fixture: ComponentFixture<OngoingConsultationPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(OngoingConsultationPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
