import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ConsultationPage } from './consultation.page';

describe('ConsultationPage', () => {
  let component: ConsultationPage;
  let fixture: ComponentFixture<ConsultationPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(ConsultationPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
