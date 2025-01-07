import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SplashComponent } from "./components/splash/splash.component";

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, SplashComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'ruleta';
}
