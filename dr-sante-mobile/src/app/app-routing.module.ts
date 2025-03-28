import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', loadChildren: () => import('./pages/login/login.module').then(m => m.LoginPageModule) },
  { path: 'register', loadChildren: () => import('./pages/register/register.module').then(m => m.RegisterPageModule) },
  { path: 'home', loadChildren: () => import('./home/home.module').then(m => m.HomePageModule) },
  { path: 'consultation', loadChildren: () => import('./pages/consultation/consultation.module').then(m => m.ConsultationPageModule) },
  { path: 'consultation-history', loadChildren: () => import('./pages/consultation-history/consultation-history.module').then(m => m.ConsultationHistoryPageModule) },
  { path: 'consultation-detail/:id', loadComponent: () => import('./pages/consultation-detail/consultation-detail.page').then(m => m.ConsultationDetailPage) },
  { path: 'consultation-rate/:id', loadChildren: () => import('./pages/consultation-rate/consultation-rate.module').then(m => m.ConsultationRatePageModule) },
  { path: 'schedule-appointment', loadChildren: () => import('./pages/schedule-appointment/schedule-appointment.module').then(m => m.ScheduleAppointmentPageModule) },
  { path: 'upcoming-appointments', loadChildren: () => import('./pages/upcoming-appointments/upcoming-appointments.module').then(m => m.UpcomingAppointmentsPageModule) },
  { path: 'doctor-dashboard', loadChildren: () => import('./pages/doctor-dashboard/doctor-dashboard.module').then(m => m.DoctorDashboardPageModule) },
  { path: 'doctor/consultations', loadChildren: () => import('./pages/doctor-consultations/doctor-consultations.module').then(m => m.DoctorConsultationsPageModule) },
  { path: 'doctor/consultation-detail/:id', loadComponent: () => import('./pages/doctor-consultation-detail/doctor-consultation-detail.page').then(m => m.DoctorConsultationDetailPage) },
  { path: 'doctor/health-alerts', loadChildren: () => import('./pages/doctor-health-alerts/doctor-health-alerts.module').then(m => m.DoctorHealthAlertsPageModule) },
  { path: 'doctor/medication-reminder', loadChildren: () => import('./pages/doctor-medication-reminder/doctor-medication-reminder.module').then(m => m.DoctorMedicationReminderPageModule) },
  { path: 'doctor/generate-report', loadChildren: () => import('./pages/doctor-generate-report/doctor-generate-report.module').then(m => m.DoctorGenerateReportPageModule) },
  { path: 'doctor/send-notification', loadChildren: () => import('./pages/doctor-send-notification/doctor-send-notification.module').then(m => m.DoctorSendNotificationPageModule) },
  { path: 'doctor/upcoming-appointments', loadChildren: () => import('./pages/doctor-upcoming-appointments/doctor-upcoming-appointments.module').then(m => m.DoctorUpcomingAppointmentsPageModule) },
  { path: 'patient-medication-reminders',loadChildren: () => import('./pages/patient-medication-reminders/patient-medication-reminders.module').then( m => m.PatientMedicationRemindersPageModule)},
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })],
  exports: [RouterModule]
})
export class AppRoutingModule {}