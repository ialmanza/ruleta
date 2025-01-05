// src/app/services/wheel.service.ts
import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { BehaviorSubject, Observable, from } from 'rxjs';
import { environment } from '../../../environments/environments';
import { DrawResult } from '../../../models/Idrawresult';
import { Player } from '../../../models/Iplayer';

@Injectable({
    providedIn: 'root'
})
export class WheelService {
    private supabase: SupabaseClient;
    private players = new BehaviorSubject<Player[]>([]);
    private playersWhoSpun = new BehaviorSubject<string[]>([]);

    constructor() {
        this.supabase = createClient(
            environment.supabaseUrl,
            environment.supabaseKey
        );
        this.loadPlayers();
    }

    private async loadPlayers(): Promise<void> {
      const { data, error } = await this.supabase
          .from('players')
          .select('*')
          .eq('is_active', true);

      if (error) throw error;

      this.players.next(data.map(player => ({
          name: player.name,
          isSelected: false
      })));
    }

    private async loadPlayersWhoSpun(): Promise<void> {
      const { data, error } = await this.supabase
          .from('draw_results')
          .select('player_who_spun')
          .order('timestamp', { ascending: true });

      if (error) throw error;

      const playersWhoSpun = data.map(result => result.player_who_spun);
      this.playersWhoSpun.next(playersWhoSpun);
  }

    getPlayers(): Observable<Player[]> {
        return this.players.asObservable();
    }

    getPlayersWhoSpun(): Observable<string[]> {
        return this.playersWhoSpun.asObservable();
    }

    hasPlayerSpun(playerName: string): boolean {
        return this.playersWhoSpun.value.includes(playerName);
    }

    async addPlayer(name: string): Promise<void> {
        const currentPlayers = this.players.value;
        if (currentPlayers.length >= 35) {
            throw new Error('Máximo número de jugadores alcanzado');
        }

        const { data, error } = await this.supabase
            .from('players')
            .insert([{ name }])
            .select()
            .single();

        if (error) {
            if (error.code === '23505') { // Código de error único de PostgreSQL
                throw new Error('El jugador ya existe');
            }
            throw error;
        }

        await this.loadPlayers(); // Recargar la lista de jugadores
    }

    async spinWheel(currentPlayerName: string): Promise<DrawResult> {

        if (this.hasPlayerSpun(currentPlayerName)) {
          throw new Error('Ya has girado la ruleta en este juego');
        }

        const currentPlayers = this.players.value;
        const availablePlayers = currentPlayers.filter(
            player => !player.isSelected && player.name !== currentPlayerName
        );

        if (availablePlayers.length === 0) {
            throw new Error('No hay jugadores disponibles');
        }

        const randomIndex = Math.floor(Math.random() * availablePlayers.length);
        const selectedPlayer = availablePlayers[randomIndex];

        // Marcar jugador como seleccionado en el estado local
        const updatedPlayers = currentPlayers.map(player =>
            player.name === selectedPlayer.name
                ? { ...player, isSelected: true }
                : player
        );
        this.players.next(updatedPlayers);

        // Guardar resultado en Supabase
        const drawResult = {
            player_who_spun: currentPlayerName,
            selected_player: selectedPlayer.name,
            timestamp: new Date()
        };

        const { data, error } = await this.supabase
            .from('draw_results')
            .insert([drawResult])
            .select()
            .single();

        if (error) throw error;

         // Actualizar la lista de jugadores que han girado
         const updatedPlayersWhoSpun = [...this.playersWhoSpun.value, currentPlayerName];
         this.playersWhoSpun.next(updatedPlayersWhoSpun);

        return {
            playerWhoSpun: data.player_who_spun,
            selectedPlayer: data.selected_player,
            timestamp: new Date(data.timestamp)
        };
    }

    async getResults(): Promise<DrawResult[]> {
        const { data, error } = await this.supabase
            .from('draw_results')
            .select('*')
            .order('timestamp', { ascending: false });

        if (error) throw error;

        return data.map(item => ({
            playerWhoSpun: item.player_who_spun,
            selectedPlayer: item.selected_player,
            timestamp: new Date(item.timestamp)
        }));
    }

    async resetGame(): Promise<void> {
        // Actualizar todos los jugadores a no seleccionados
        const { error } = await this.supabase
            .from('players')
            .update({ is_active: false })
            .eq('is_active', true);

        if (error) throw error;

        this.players.next([]);
    }

    // Método para calcular los ángulos de la ruleta
    calculateWheelSegments(players: Player[]): Array<{name: string, angle: number, color: string}> {
        const segmentAngle = 360 / players.length;
        const colors = this.generateColors(players.length);

        return players.map((player, index) => ({
            name: player.name,
            angle: index * segmentAngle,
            color: colors[index]
        }));
    }

    private generateColors(count: number): string[] {
        // Generar colores distintos para cada segmento
        return Array.from({ length: count }, (_, i) =>
            `hsl(${(i * 360) / count}, 70%, 50%)`
        );
    }
}
