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
    private selectedPlayers: string[] = [];
    private spinners: string[] = [];

    constructor() {
        this.supabase = createClient(
            environment.supabaseUrl,
            environment.supabaseKey
        );
        this.loadPlayers();
        this.loadGameState();
    }

    private async loadPlayers(): Promise<void> {
      await this.loadGameState();
      const { data, error } = await this.supabase
          .from('players')
          .select('*')
          .eq('is_active', true);

      if (error) throw error;

      this.players.next(data.map(player => ({
        name: player.name,
        isSelected: this.selectedPlayers.includes(player.name),
        hasSpun: this.spinners.includes(player.name)
      })));

    }

  private async loadGameState(): Promise<void> {

    const { data, error } = await this.supabase
        .from('draw_results')
        .select('*')
        .order('timestamp', { ascending: true });

    if (error) throw error;

    this.selectedPlayers = [...new Set(data.map(result => result.selected_player))];
    this.spinners = [...new Set(data.map(result => result.player_who_spun))];

    this.playersWhoSpun.next(this.spinners);

    await this.updatePlayersState();
  }

  private async updatePlayersState(): Promise<void> {
        const currentPlayers = this.players.value;
        const updatedPlayers = currentPlayers.map(player => ({
            ...player,
            isSelected: this.selectedPlayers.includes(player.name),
            hasSpun: this.spinners.includes(player.name)
        }));
        this.players.next(updatedPlayers);
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

        await this.loadPlayers();
    }


  async spinWheel(currentPlayerName: string): Promise<DrawResult> {
    await this.loadGameState();

    if (this.spinners.includes(currentPlayerName)) {
      throw new Error('Ya has girado la ruleta en este juego');
    }

    const currentPlayers = this.players.value;

    const availablePlayers = currentPlayers.filter(player =>
        !this.selectedPlayers.includes(player.name) &&
        player.name !== currentPlayerName
    );

    if (availablePlayers.length === 0) {
        throw new Error('No hay jugadores disponibles para seleccionar');
    }

    if (this.playersWhoSpun.value.includes(currentPlayerName)) {
        throw new Error('Ya has girado la ruleta en este juego');
    }

    const randomIndex = Math.floor(Math.random() * availablePlayers.length);
    const selectedPlayer = availablePlayers[randomIndex];

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

    this.selectedPlayers.push(selectedPlayer.name);
    this.spinners.push(currentPlayerName);

    this.playersWhoSpun.next(this.spinners);
    await this.updatePlayersState();

    const updatedPlayers = currentPlayers.map(player =>
        player.name === selectedPlayer.name
            ? { ...player, isSelected: true }
            : player
    );
    this.players.next(updatedPlayers);

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

      const { error: deleteError } = await this.supabase
          .from('draw_results')
          .delete()
          .neq('player_who_spun', ''); // Elimina todos los registros

      if (deleteError) throw deleteError;

      this.selectedPlayers = [];
      this.spinners = [];
      this.playersWhoSpun.next([]);
      await this.updatePlayersState();
  }

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
        return Array.from({ length: count }, (_, i) =>
            `hsl(${(i * 360) / count}, 70%, 50%)`
        );
    }
}
