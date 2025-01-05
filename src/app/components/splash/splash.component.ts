import { Component, ElementRef, ViewChild } from '@angular/core';
import { Platform } from '@angular/cdk/platform';
import { CommonModule } from '@angular/common';
import confetti from 'canvas-confetti';

@Component({
  selector: 'app-splash',
  imports: [ CommonModule ],
  templateUrl: './splash.component.html',
  styleUrl: './splash.component.css'
})
export class SplashComponent {
  showSplash = true;
  @ViewChild('confettiCanvas') confettiCanvas!: ElementRef;

  constructor(private platform: Platform) {}

  ngOnInit() {
    if (this.platform.isBrowser) {
      // Iniciar el confeti inmediatamente
      this.triggerConfetti();

      // Temporizador para ocultar el splash
      window.addEventListener('load', () => {
        setTimeout(() => {
          this.showSplash = false;
        }, 4000);
      });
    }
  }

  triggerConfetti() {
    const end = Date.now() + 2000; // duración de 1 segundo

    // Configuración de confeti a la izquierda
    const left = confetti.create(undefined, {
      resize: true,
      useWorker: true,
      disableForReducedMotion: true
    });

    // Configuración de confeti a la derecha
    const right = confetti.create(undefined, {
      resize: true,
      useWorker: true,
      disableForReducedMotion: true
    });

    const animateConfetti = () => {
      const now = Date.now();

      // Lanzar confeti desde ambos lados
      left({
        particleCount: 2,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.7 }
      });

      right({
        particleCount: 2,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.7 }
      });

      if (now < end) {
        requestAnimationFrame(animateConfetti);
      }
    };

    animateConfetti();
  }
}
