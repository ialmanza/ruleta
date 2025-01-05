import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { DrawResult } from '../../../models/Idrawresult';
import { Player } from '../../../models/Iplayer';
import { WheelService } from '../../services/_Wheel/wheel.service';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { FormsModule } from '@angular/forms';

@Component({
    selector: 'app-wheel',
    imports: [CommonModule, ReactiveFormsModule, FormsModule],
    templateUrl: './wheel.component.html',
    styleUrl: './wheel.component.css'
})
export class WheelComponent implements OnInit {
    playerForm: FormGroup;
    spinForm: FormGroup;
    players: Player[] = [];
    playersWhoSpun: string[] = [];
    results: DrawResult[] = [];
    isSpinning = false;
    error: string | null = null;
    success: string | null = null;
    wheelRotation = 0;
    wheelSegments: Array<{ name: string, angle: number, color: string }> = [];
    private readonly SPIN_DURATION = 4000; // 4 segundos de giro

    constructor(
        private fb: FormBuilder,
        private wheelService: WheelService
    ) {
        this.playerForm = this.fb.group({
            name: ['', [Validators.required, Validators.minLength(2)]]
        });
        this.spinForm = this.fb.group({
            currentPlayer: ['', Validators.required]
        });
    }

    ngOnInit(): void {
        this.wheelService.getPlayers().subscribe(players => {
            this.players = players;
            this.wheelSegments = this.wheelService.calculateWheelSegments(players);
        });

        this.wheelService.getPlayersWhoSpun().subscribe(players => {
          this.playersWhoSpun = players;
      });

        this.loadResults();
    }

    hasPlayerSpun(playerName: string): boolean {
      return this.playersWhoSpun.includes(playerName);
    }

    getAvailablePlayers(): Player[] {
      return this.players.filter(player => !this.hasPlayerSpun(player.name));
    }

    async loadResults(): Promise<void> {
        try {
            this.results = await this.wheelService.getResults();
        } catch (error) {
            this.error = 'Error al cargar los resultados';
        }
    }

    addPlayer(): void {
        if (this.playerForm.valid) {
            try {
                this.wheelService.addPlayer(this.playerForm.get('name')?.value);
                this.playerForm.reset();
                this.success = 'Jugador agregado exitosamente';
                this.error = null;
            } catch (error: any) {
                this.error = error.message;
                this.success = null;
            }
        }
    }

    async spinWheel(): Promise<void> {
        if (this.spinForm.valid && !this.isSpinning) {
            this.isSpinning = true;
            this.error = null;
            this.success = null;

            try {
                const currentPlayer = this.spinForm.get('currentPlayer')?.value;

                // Calcular rotación aleatoria (entre 5 y 10 vueltas completas)
                const minSpins = 5;
                const maxSpins = 10;
                const spins = minSpins + Math.random() * (maxSpins - minSpins);
                const baseRotation = spins * 360;

                // Obtener el resultado del servicio
                const result = await this.wheelService.spinWheel(currentPlayer);

                // Encontrar el segmento del jugador seleccionado
                const selectedSegment = this.wheelSegments.find(
                    segment => segment.name === result.selectedPlayer
                );

                if (!selectedSegment) {
                    throw new Error('Error al encontrar el jugador seleccionado');
                }

                // Calcular la rotación final para que apunte al jugador seleccionado
                const finalRotation = baseRotation + (360 - selectedSegment.angle);

                // Aplicar la animación
                this.wheelRotation = finalRotation;

                // Esperar a que termine la animación antes de mostrar el resultado
                await new Promise(resolve => setTimeout(resolve, this.SPIN_DURATION));

                this.results = [result, ...this.results];
                this.success = `¡${result.selectedPlayer} ha sido seleccionado!`;
                this.spinForm.reset();

                // Actualizar los segmentos de la rueda con los jugadores actualizados
                this.wheelSegments = this.wheelService.calculateWheelSegments(this.players);

            } catch (error: any) {
                this.error = error.message;
            } finally {
                this.isSpinning = false;
            }
        }
    }

    async resetGame(): Promise<void> {
        if (confirm('¿Estás seguro de que deseas reiniciar el juego?')) {
            try {
                await this.wheelService.resetGame();
                this.spinForm.reset();
                this.wheelRotation = 0;
                this.success = 'Juego reiniciado exitosamente';
                this.error = null;
                this.wheelSegments = [];
            } catch (error: any) {
                this.error = error.message;
            }
        }
    }

    // Método para obtener el estilo de transición basado en si está girando
    getWheelTransitionStyle(): string {
        return this.isSpinning
            ? `transform ${this.SPIN_DURATION}ms cubic-bezier(0.17, 0.67, 0.12, 0.99)`
            : 'transform 0.2s ease-out';
    }
}
