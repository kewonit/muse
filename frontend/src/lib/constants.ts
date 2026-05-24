export const GAME_CONSTANTS = {
  DURATIONS: [5, 10, 15] as const,
  ROUND_OPTIONS: [5, 10, 20] as const,
  CHOICE_OPTIONS: [2, 3, 5] as const,
  DEFAULT_DURATION: 5,
  DEFAULT_ROUNDS: 5,
  DEFAULT_CHOICE_COUNT: 3,
  DEFAULT_MAX_PLAYERS: 24,
  SOLO_MAX_PLAYERS: 1,
  ROOM_TTL_MINUTES: 45,
  MIN_ARTIST_CATALOG: 5,
  ITUNES_API_BASE: "https://itunes.apple.com/search",
} as const;

export type GameMode = "mashup" | "dictator";
export type EntryKind = "solo" | "group";
export type CatalogMode = "random" | "artists";
export type GameStatus = "waiting" | "countdown" | "playing" | "reveal" | "finished";
export type PlayerStatus = "waiting" | "ready" | "spectating" | "playing" | "finished";

export interface Song {
  previewUrl: string;
  trackName: string;
  artistName: string;
  artworkUrl: string;
}

export interface ArtistSearchResult {
  artistId: number;
  artistName: string;
  primaryGenreName?: string;
  artistLinkUrl?: string;
  artworkUrl?: string;
}

export interface SongChoice {
  id: string;
  trackName: string;
  artistName: string;
  artworkUrl: string;
}

export interface Lobby {
  id: string;
  code: string;
  host: string;
  status: GameStatus;
  mode: GameMode;
  duration: number;
  rounds_total: number;
  current_round: number;
  max_players?: number;
  choice_count?: number;
  artists?: unknown;
  song_pool?: Song[];
  expires_at: string;
}

export interface PlayerAnswer {
  round_number: number;
  guess: string;
  time_ms: number;
  correct: boolean;
  points: number;
  is_clutch: boolean;
  song_name: string;
  artist_name: string;
  album_art?: string;
  choice_id?: string;
}

export interface Player {
  id: string;
  lobby: string;
  user: string;
  name: string;
  score: number;
  streak: number;
  status: PlayerStatus;
  current_round?: number;
  round_started_at?: string;
  finished_at?: string;
  artists?: Song[];
  answers?: PlayerAnswer[];
  joined_at: string;
  expand?: {
    user?: { id: string; username: string };
  };
}

export interface Round {
  id: string;
  lobby: string;
  round_number: number;
  song_url: string;
  song_name?: string;
  artist_name?: string;
  album_art?: string;
  started_at: string;
  answers?: Record<string, { guess: string; time_ms: number; correct: boolean; points?: number; is_clutch?: boolean }>;
  revealed: boolean;
}

export interface CurrentRound {
  started: boolean;
  finished: boolean;
  round_id?: string;
  round_number?: number;
  total_rounds?: number;
  duration?: number;
  song_url?: string;
  album_art?: string;
  choices?: SongChoice[];
  started_at?: string;
  server_time: string;
}

export interface GuessResult {
  finished: boolean;
  answer: PlayerAnswer;
}
