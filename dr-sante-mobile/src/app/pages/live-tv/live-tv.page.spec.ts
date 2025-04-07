import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LiveTvPage } from './live-tv.page';

describe('LiveTvPage', () => {
  let component: LiveTvPage;
  let fixture: ComponentFixture<LiveTvPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(LiveTvPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
