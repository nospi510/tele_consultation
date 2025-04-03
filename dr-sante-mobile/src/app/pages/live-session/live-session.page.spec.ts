import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LiveSessionPage } from './live-session.page';

describe('LiveSessionPage', () => {
  let component: LiveSessionPage;
  let fixture: ComponentFixture<LiveSessionPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(LiveSessionPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
