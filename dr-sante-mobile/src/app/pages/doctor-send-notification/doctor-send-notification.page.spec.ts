import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DoctorSendNotificationPage } from './doctor-send-notification.page';

describe('DoctorSendNotificationPage', () => {
  let component: DoctorSendNotificationPage;
  let fixture: ComponentFixture<DoctorSendNotificationPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(DoctorSendNotificationPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
