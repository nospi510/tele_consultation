import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ConsultationHistoryPage } from './consultation-history.page';

describe('ConsultationHistoryPage', () => {
  let component: ConsultationHistoryPage;
  let fixture: ComponentFixture<ConsultationHistoryPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(ConsultationHistoryPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
