// // src/app/services/wheel.service.ts
// import { Injectable } from '@angular/core';
// import { createClient, SupabaseClient } from '@supabase/supabase-js';
// import { BehaviorSubject, Observable } from 'rxjs';
// import { DrawResult } from '../../models/Idrawresult';
// import { Player } from '../../models/Iplayer';
// import { environment } from '../../../environments/environments';

// @Injectable({
//     providedIn: 'root'
// })
// export class WheelService {
//     private supabase: SupabaseClient;
//     private players = new BehaviorSubject<Player[]>([]);
//     private readonly PLAYERS_KEY = 'wheelPlayers';

//     constructor() {
//         this.supabase = createClient(
//             environment.supabaseUrl,
//             environment.supabaseKey
//         );
//         this.loadPlayersFromStorage();
//     }

//     private loadPlayersFromStorage(): void {
//         const storedPlayers = localStorage.getItem(this.PLAYERS_KEY);
//         if (storedPlayers) {
//             this.players.next(JSON.parse(storedPlayers));
//         }
//     }

//     private savePlayersToStorage(players: Player[]): void {
//         localStorage.setItem(this.PLAYERS_KEY, JSON.stringify(players));
//         this.players.next(players);
//     }

//     getPlayers(): Observable<Player[]> {
//         return this.players.asObservable();
//     }

//     addPlayer(name: string): void {
//         const currentPlayers = this.players.value;
//         if (currentPlayers.length >= 35) {
//             throw new Error('Máximo número de jugadores alcanzado');
//         }

//         if (currentPlayers.some(player => player.name.toLowerCase() === name.toLowerCase())) {
//             throw new Error('El jugador ya existe');
//         }

//         const newPlayer: Player = {
//             name,
//             isSelected: false
//         };

//         this.savePlayersToStorage([...currentPlayers, newPlayer]);
//     }

//     async spinWheel(currentPlayerName: string): Promise<DrawResult> {
//       const currentPlayers = this.players.value;
//       const availablePlayers = currentPlayers.filter(
//           player => !player.isSelected && player.name !== currentPlayerName
//       );

//       if (availablePlayers.length === 0) {
//           throw new Error('No hay jugadores disponibles');
//       }

//       const randomIndex = Math.floor(Math.random() * availablePlayers.length);
//       const selectedPlayer = availablePlayers[randomIndex];

//       // Marcar jugador como seleccionado
//       const updatedPlayers = currentPlayers.map(player =>
//           player.name === selectedPlayer.name
//               ? { ...player, isSelected: true }
//               : player
//       );

//       this.savePlayersToStorage(updatedPlayers);

//       // Guardar resultado en Supabase usando snake_case
//       const drawResult = {
//           player_who_spun: currentPlayerName,
//           selected_player: selectedPlayer.name,
//           timestamp: new Date()
//       };

//       const { data, error } = await this.supabase
//           .from('draw_results')
//           .insert([drawResult])
//           .select()
//           .single();

//       if (error) throw error;

//       // Convertir la respuesta a camelCase para la interfaz
//       return {
//           playerWhoSpun: data.player_who_spun,
//           selectedPlayer: data.selected_player,
//           timestamp: new Date(data.timestamp)
//       };
//   }

//   async getResults(): Promise<DrawResult[]> {
//     const { data, error } = await this.supabase
//         .from('draw_results')
//         .select('*')
//         .order('timestamp', { ascending: false });

//     if (error) throw error;

//     // Convertir la respuesta a camelCase para la interfaz
//     return data.map(item => ({
//         playerWhoSpun: item.player_who_spun,
//         selectedPlayer: item.selected_player,
//         timestamp: new Date(item.timestamp)
//     }));
// }

//     resetGame(): void {
//         this.savePlayersToStorage([]);
//     }
// }


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

    getPlayers(): Observable<Player[]> {
        return this.players.asObservable();
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
