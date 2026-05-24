import { GAME_CONSTANTS, type ArtistSearchResult, type Song } from "./constants";

export interface ITunesResult {
  wrapperType?: string;
  kind?: string;
  artistId?: number;
  trackId?: number;
  trackName?: string;
  artistName?: string;
  artistLinkUrl?: string;
  previewUrl?: string;
  artworkUrl30?: string;
  artworkUrl60?: string;
  artworkUrl100?: string;
  collectionName?: string;
  trackTimeMillis?: number;
  primaryGenreName?: string;
}

interface ITunesResponse {
  resultCount: number;
  results: ITunesResult[];
}

interface SearchArtistsOptions {
  includeArtwork?: boolean;
}

const DEFAULT_ROOM_ARTISTS = [
  "The Beatles",
  "Taylor Swift",
  "Drake",
  "Adele",
  "Coldplay",
  "Ed Sheeran",
  "Bruno Mars",
  "Dua Lipa",
  "The Weeknd",
  "Rihanna",
  "Beyonce",
  "Ariana Grande",
  "Billie Eilish",
  "Post Malone",
  "Harry Styles",
  "Olivia Rodrigo",
  "Sabrina Carpenter",
  "Doja Cat",
  "SZA",
  "Kendrick Lamar",
  "Kanye West",
  "Travis Scott",
  "Nicki Minaj",
  "Eminem",
  "Jay-Z",
  "Katy Perry",
  "Lady Gaga",
  "Justin Bieber",
  "Selena Gomez",
  "Miley Cyrus",
  "Lana Del Rey",
  "Lorde",
  "Charli XCX",
  "Chappell Roan",
  "Hozier",
  "Noah Kahan",
  "Zach Bryan",
  "Morgan Wallen",
  "Luke Combs",
  "Chris Stapleton",
  "Kacey Musgraves",
  "Shania Twain",
  "Dolly Parton",
  "Fleetwood Mac",
  "Queen",
  "Elton John",
  "David Bowie",
  "Prince",
  "Michael Jackson",
  "Madonna",
  "Whitney Houston",
  "Mariah Carey",
  "Stevie Wonder",
  "Marvin Gaye",
  "Aretha Franklin",
  "Bob Dylan",
  "Bruce Springsteen",
  "Billy Joel",
  "Paul Simon",
  "The Rolling Stones",
  "Led Zeppelin",
  "Pink Floyd",
  "U2",
  "Radiohead",
  "Oasis",
  "Blur",
  "Arctic Monkeys",
  "The Killers",
  "The Strokes",
  "Tame Impala",
  "Gorillaz",
  "Daft Punk",
  "Calvin Harris",
  "David Guetta",
  "Avicii",
  "Marshmello",
  "Skrillex",
  "Fred again..",
  "Bad Bunny",
  "J Balvin",
  "Karol G",
  "Shakira",
  "Enrique Iglesias",
  "Rosalia",
  "Peso Pluma",
  "BTS",
  "BLACKPINK",
  "NewJeans",
  "TWICE",
  "Stray Kids",
  "EXO",
  "Red Velvet",
  "Nirvana",
  "Pearl Jam",
  "Foo Fighters",
  "Red Hot Chili Peppers",
  "Green Day",
  "Linkin Park",
  "Paramore",
  "Fall Out Boy",
  "My Chemical Romance",
  "Panic! At The Disco",
  "Twenty One Pilots",
  "Imagine Dragons",
  "Maroon 5",
  "OneRepublic",
  "One Direction",
  "Jonas Brothers",
  "The 1975",
  "Bon Iver",
  "Frank Ocean",
  "Tyler, The Creator",
  "Childish Gambino",
  "Anderson .Paak",
  "Brent Faiyaz",
  "Giveon",
  "Usher",
  "Alicia Keys",
  "John Legend",
  "The Notorious B.I.G.",
  "2Pac",
  "Nas",
  "J. Cole",
  "Future",
  "Lil Wayne",
  "Megan Thee Stallion",
  "Cardi B",
  "Lizzo",
  "TLC",
  "Outkast",
  "Missy Elliott",
  "Sade",
  "Amy Winehouse",
  "Norah Jones",
  "John Mayer",
  "Jack Johnson",
  "The Lumineers",
  "Mumford & Sons",
  "ABBA",
  "Bee Gees",
  "Earth, Wind & Fire",
  "The Beach Boys",
  "The Smiths",
  "The Cure",
  "Depeche Mode",
  "Metallica",
  "AC/DC",
  "Guns N' Roses",
  "Aerosmith",
  "Bon Jovi",
  "Eagles",
  "Steely Dan",
];

const SEARCH_LIMIT = 5;
const ARTIST_SONG_LIMIT = 80;
const DEFAULT_ARTIST_LOOKUP_LIMIT = 60;
const DEFAULT_RANDOM_ARTIST_BATCH_SIZE = 4;
const DEFAULT_RANDOM_ARTIST_MAX_ATTEMPTS = 36;
const CLIENT_SONG_POOL_LIMIT = 180;
const FETCH_BATCH_DELAY_MS = 160;
const FETCH_TIMEOUT_MS = 8000;
const PB_URL = process.env.NEXT_PUBLIC_POCKETBASE_URL || "http://127.0.0.1:8090";
const artistSearchCache = new Map<string, Promise<ArtistSearchResult[]>>();
const artistSongsCache = new Map<string, Promise<Song[]>>();

async function fetchWithTimeout(url: string, options?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function searchArtists(
  query: string,
  options: SearchArtistsOptions = {}
): Promise<ArtistSearchResult[]> {
  const trimmedQuery = query.trim();
  if (trimmedQuery.length < 2) return [];
  const cacheKey = `${normalizeSearchText(trimmedQuery)}:${options.includeArtwork === false ? "plain" : "art"}`;
  const cached = artistSearchCache.get(cacheKey);
  if (cached) return cached;

  const request = (async () => {
    const url = new URL(`${PB_URL}/api/muse/itunes/search`);
    url.searchParams.set("term", trimmedQuery);
    url.searchParams.set("media", "music");
    url.searchParams.set("entity", "musicArtist");
    url.searchParams.set("attribute", "artistTerm");
    url.searchParams.set("limit", String(SEARCH_LIMIT));

    const response = await fetchWithTimeout(url.toString());
    if (!response.ok) throw new Error("Music search failed");

    const data: ITunesResponse = await response.json();
    const queryKey = normalizeSearchText(trimmedQuery);
    const artists = dedupeArtists(data.results)
      .filter((artist) => normalizeSearchText(artist.artistName).includes(queryKey))
      .slice(0, SEARCH_LIMIT);
    if (options.includeArtwork === false) return artists;
    return Promise.all(artists.map(withArtistPortrait));
  })();

  artistSearchCache.set(cacheKey, request);
  return request;
}

export async function getArtistSongs(artist: ArtistSearchResult, limit = ARTIST_SONG_LIMIT): Promise<Song[]> {
  const normalizedLimit = Math.max(1, Math.min(ARTIST_SONG_LIMIT, Math.floor(limit)));
  const cacheKey = `${artist.artistId}:${normalizedLimit}`;
  const cached = artistSongsCache.get(cacheKey);
  if (cached) return cached;

  const request = (async () => {
    const url = new URL(`${PB_URL}/api/muse/itunes/lookup`);
    url.searchParams.set("id", String(artist.artistId));
    url.searchParams.set("entity", "song");
    url.searchParams.set("limit", String(normalizedLimit));

    const response = await fetchWithTimeout(url.toString());
    if (!response.ok) throw new Error("Music lookup failed");

    const data: ITunesResponse = await response.json();
    const songs = data.results
      .filter((result) => result.wrapperType === "track")
      .filter((result) => result.kind === "song")
      .filter((result) => result.artistId === artist.artistId)
      .map(toSong);

    return uniquePlayableSongs(songs);
  })();

  artistSongsCache.set(cacheKey, request);
  return request;
}

export async function validateArtistCatalog(
  artist: ArtistSearchResult,
  minTracks: number
): Promise<{ valid: boolean; songs: Song[] }> {
  try {
    const songs = await getArtistSongs(artist);
    return { valid: songs.length >= minTracks, songs };
  } catch {
    return { valid: false, songs: [] };
  }
}

export function buildSongPoolFromArtists(artistSongs: Song[][], rounds: number, choiceCount: number): Song[] {
  return buildBoundedSongPool(artistSongs, rounds, choiceCount);
}

export async function buildDefaultSongPool(
  rounds: number,
  choiceCount: number = GAME_CONSTANTS.DEFAULT_CHOICE_COUNT
): Promise<Song[]> {
  const artistSongGroups: Song[][] = [];
  const candidateArtists = shuffleItems(DEFAULT_ROOM_ARTISTS).slice(0, DEFAULT_RANDOM_ARTIST_MAX_ATTEMPTS);

  for (let index = 0; index < candidateArtists.length; index += DEFAULT_RANDOM_ARTIST_BATCH_SIZE) {
    const artistBatch = candidateArtists.slice(index, index + DEFAULT_RANDOM_ARTIST_BATCH_SIZE);
    const batchResults = await Promise.all(
      artistBatch.map(async (artistName) => {
        try {
          const artists = await searchArtists(artistName, { includeArtwork: false });
          const artist = bestArtistMatch(artists, artistName);
          if (!artist) return [];
          return await getArtistSongs(artist, DEFAULT_ARTIST_LOOKUP_LIMIT);
        } catch {
          return [];
        }
      })
    );

    artistSongGroups.push(...batchResults.filter((songs) => songs.length > 0));
    if (hasEnoughSongCapacity(artistSongGroups, rounds, choiceCount)) {
      break;
    }
    await wait(FETCH_BATCH_DELAY_MS);
  }

  return buildBoundedSongPool(artistSongGroups, rounds, choiceCount);
}

function requiredSongPoolSize(rounds: number, choiceCount: number): number {
  return Math.max(rounds * Math.max(1, choiceCount), rounds + 5);
}

function buildBoundedSongPool(artistSongs: Song[][], rounds: number, choiceCount: number): Song[] {
  const requiredSongs = requiredSongPoolSize(rounds, choiceCount);
  const normalizedChoiceCount = Math.max(1, choiceCount);
  const uniqueSongs = uniquePlayableSongs(artistSongs.flat());
  if (uniqueSongs.length < requiredSongs) {
    throw new Error("Not enough tracks. Pick another.");
  }

  const groups = shuffleItems(
    groupSongsByArtistName(uniqueSongs)
      .map((songs) => shuffleItems(uniquePlayableSongs(songs)))
      .filter((songs) => songs.length >= normalizedChoiceCount)
  ).map((songs) => ({ songs, cursor: 0 }));

  const selectedSongs: Song[] = [];
  while (selectedSongs.length < requiredSongs && selectedSongs.length < CLIENT_SONG_POOL_LIMIT) {
    let progressed = false;
    for (const group of groups) {
      if (group.cursor + normalizedChoiceCount > group.songs.length) continue;
      selectedSongs.push(...group.songs.slice(group.cursor, group.cursor + normalizedChoiceCount));
      group.cursor += normalizedChoiceCount;
      progressed = true;
      if (selectedSongs.length >= requiredSongs) break;
    }
    if (!progressed) break;
  }

  const selectedKeys = new Set(selectedSongs.map(songIdentity));
  if (selectedSongs.length < requiredSongs) {
    for (const song of shuffleItems(uniqueSongs)) {
      if (selectedKeys.has(songIdentity(song))) continue;
      selectedSongs.push(song);
      selectedKeys.add(songIdentity(song));
      if (selectedSongs.length >= requiredSongs) break;
    }
  }

  const songPool = uniquePlayableSongs(selectedSongs).slice(0, CLIENT_SONG_POOL_LIMIT);
  if (songPool.length < requiredSongs) {
    throw new Error("Not enough tracks. Pick another.");
  }

  return shuffleItems(songPool);
}

function hasEnoughSongCapacity(artistSongs: Song[][], rounds: number, choiceCount: number): boolean {
  const uniqueSongs = uniquePlayableSongs(artistSongs.flat());
  return uniqueSongs.length >= requiredSongPoolSize(rounds, choiceCount);
}

function groupSongsByArtistName(songs: Song[]): Song[][] {
  const groups = new Map<string, Song[]>();
  for (const song of songs) {
    const key = normalizeArtistName(song.artistName);
    if (!key) continue;
    const group = groups.get(key);
    if (group) {
      group.push(song);
    } else {
      groups.set(key, [song]);
    }
  }
  return Array.from(groups.values());
}

function bestArtistMatch(artists: ArtistSearchResult[], artistName: string): ArtistSearchResult | undefined {
  const expectedKey = normalizeSearchText(artistName);
  return artists.find((artist) => normalizeSearchText(artist.artistName) === expectedKey) || artists[0];
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => globalThis.setTimeout(resolve, ms));
}

function shuffleItems<T>(items: T[]): T[] {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index--) {
    const swapIndex = randomInt(index + 1);
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function randomInt(maxExclusive: number): number {
  if (maxExclusive <= 1) return 0;
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.getRandomValues) {
    const values = new Uint32Array(1);
    cryptoApi.getRandomValues(values);
    return values[0] % maxExclusive;
  }
  return Math.floor(Math.random() * maxExclusive);
}

function dedupeArtists(results: ITunesResult[]): ArtistSearchResult[] {
  const seenArtistIds = new Set<number>();
  const artists: ArtistSearchResult[] = [];

  for (const result of results) {
    if (!result.artistId || !result.artistName) continue;
    if (seenArtistIds.has(result.artistId)) continue;
    seenArtistIds.add(result.artistId);
    artists.push({
      artistId: result.artistId,
      artistName: result.artistName.trim(),
      primaryGenreName: result.primaryGenreName,
      artistLinkUrl: result.artistLinkUrl,
    });
  }

  return artists;
}

function normalizeSearchText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function normalizeArtistName(value: string): string {
  return value.toLowerCase().trim();
}

async function withArtistPortrait(artist: ArtistSearchResult): Promise<ArtistSearchResult> {
  if (!artist.artistLinkUrl) return artist;

  try {
    const url = new URL(`${PB_URL}/api/muse/artist-artwork`);
    url.searchParams.set("url", artist.artistLinkUrl);
    const response = await fetchWithTimeout(url.toString());
    if (!response.ok) return artist;
    const data = await response.json() as { artworkUrl?: string };
    return { ...artist, artworkUrl: data.artworkUrl };
  } catch {
    return artist;
  }
}

function toSong(result: ITunesResult): Song {
  return {
    previewUrl: result.previewUrl || "",
    trackName: result.trackName || "",
    artistName: result.artistName || "",
    artworkUrl: highResolutionArtwork(result.artworkUrl100 || result.artworkUrl60 || result.artworkUrl30 || ""),
  };
}

function highResolutionArtwork(url: string): string {
  if (!url) return "";
  return url.replace(/\/\d+x\d+bb\.(jpg|png|webp)$/i, "/1000x1000bb.$1");
}

function uniquePlayableSongs(songs: Song[]): Song[] {
  const seenPreviewUrls = new Set<string>();
  const seenTitles = new Set<string>();

  return songs.filter((song) => {
    if (!song.previewUrl || !song.trackName || !song.artistName || !song.artworkUrl) return false;

    const previewKey = song.previewUrl.toLowerCase();
    const titleKey = songIdentity(song);
    if (seenPreviewUrls.has(previewKey) || seenTitles.has(titleKey)) return false;

    seenPreviewUrls.add(previewKey);
    seenTitles.add(titleKey);
    return true;
  });
}

function songIdentity(song: Song): string {
  return `${song.trackName}::${song.artistName}`.toLowerCase().trim();
}
