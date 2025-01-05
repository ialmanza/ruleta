import { Routes } from '@angular/router';
import { WheelComponent } from './components/wheel/wheel.component';
import { SplashComponent } from './components/splash/splash.component';

export const routes: Routes = [
  { path: '', component: WheelComponent },
  { path: 'splash', component: SplashComponent },
];
