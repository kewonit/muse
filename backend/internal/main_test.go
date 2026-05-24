package internal

import (
	"fmt"
	"testing"
	"time"
)

func TestScoreChoice(t *testing.T) {
	tests := []struct {
		name            string
		correct         bool
		durationSeconds int
		elapsedMS       int64
		streak          int
		wantPoints      int
		wantClutch      bool
	}{
		{"wrong answer", false, 10, 1000, 0, 0, false},
		{"instant correct", true, 10, 0, 0, 1000, false},
		{"within 1s", true, 10, 500, 0, 1000, false},
		{"halfway decay", true, 10, 5500, 0, 550, false},
		{"minimum points", true, 10, 10000, 0, 100, true},
		{"beyond time limit", true, 10, 10001, 0, 0, false},
		{"duration capped at thirty seconds", true, 45, 31000, 0, 0, false},
		{"duration cap boundary", true, 45, 30000, 0, 100, true},
		{"streak 3x", true, 10, 2000, 3, 1080, false},
		{"streak 5x", true, 10, 2000, 5, 1350, false},
		{"clutch finish", true, 10, 9700, 0, 130, true},
		{"single second duration", true, 1, 0, 0, 1000, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gotPoints, gotClutch := scoreChoice(tt.correct, tt.durationSeconds, tt.elapsedMS, tt.streak)
			if gotPoints != tt.wantPoints {
				t.Errorf("scoreChoice() points = %v, want %v", gotPoints, tt.wantPoints)
			}
			if gotClutch != tt.wantClutch {
				t.Errorf("scoreChoice() clutch = %v, want %v", gotClutch, tt.wantClutch)
			}
		})
	}
}

func TestFuzzyMatch(t *testing.T) {
	tests := []struct {
		name   string
		guess  string
		target string
		want   bool
	}{
		{"exact match", "Hello", "hello", true},
		{"substring", "Hel", "hello", true},
		{"levenshtein close", "Heloo", "Hello", true},
		{"empty guess", "", "hello", false},
		{"empty target", "hello", "", false},
		{"totally different", "xyz", "hello", false},
		{"punctuation ignored", "Don't Stop Me Now", "dont stop me now", true},
		{"unicode handled", "Café", "cafe", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := fuzzyMatch(tt.guess, tt.target)
			if got != tt.want {
				t.Errorf("fuzzyMatch(%q, %q) = %v, want %v", tt.guess, tt.target, got, tt.want)
			}
		})
	}
}

func TestNormalizeTitle(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		{"Hello World", "hello world"},
		{"Don't Stop", "dont stop"},
		{"  Spaces  ", "spaces"},
		{"!!!", ""},
		{"", ""},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			got := normalizeTitle(tt.input)
			if got != tt.want {
				t.Errorf("normalizeTitle(%q) = %q, want %q", tt.input, got, tt.want)
			}
		})
	}
}

func TestRandomCode(t *testing.T) {
	seen := make(map[string]bool)
	for i := 0; i < 1000; i++ {
		code := randomCode(6)
		if len(code) != 6 {
			t.Fatalf("expected length 6, got %d", len(code))
		}
		if seen[code] {
			t.Fatalf("duplicate code generated: %s", code)
		}
		seen[code] = true
	}
}

func TestCleanSongPool(t *testing.T) {
	tests := []struct {
		name          string
		songs         []Song
		requiredSongs int
		wantErr       bool
	}{
		{
			name: "valid pool",
			songs: []Song{
				{PreviewURL: "http://a", TrackName: "A", ArtistName: "B", ArtworkURL: "http://c"},
				{PreviewURL: "http://d", TrackName: "D", ArtistName: "E", ArtworkURL: "http://f"},
			},
			requiredSongs: 2,
			wantErr:       false,
		},
		{
			name: "not enough songs",
			songs: []Song{
				{PreviewURL: "http://a", TrackName: "A", ArtistName: "B", ArtworkURL: "http://c"},
			},
			requiredSongs: 2,
			wantErr:       true,
		},
		{
			name: "missing preview url",
			songs: []Song{
				{PreviewURL: "", TrackName: "A", ArtistName: "B", ArtworkURL: "http://c"},
			},
			requiredSongs: 1,
			wantErr:       true,
		},
		{
			name: "duplicates removed",
			songs: []Song{
				{PreviewURL: "http://a", TrackName: "A", ArtistName: "B", ArtworkURL: "http://c"},
				{PreviewURL: "http://a", TrackName: "A2", ArtistName: "B2", ArtworkURL: "http://c2"},
				{PreviewURL: "http://d", TrackName: "D", ArtistName: "E", ArtworkURL: "http://f"},
			},
			requiredSongs: 2,
			wantErr:       false,
		},
		{
			name: "duplicate title artist removed",
			songs: []Song{
				{PreviewURL: "http://a", TrackName: "Same Song", ArtistName: "Same Artist", ArtworkURL: "http://c"},
				{PreviewURL: "http://b", TrackName: "same song", ArtistName: "same artist", ArtworkURL: "http://d"},
				{PreviewURL: "http://e", TrackName: "Other Song", ArtistName: "Same Artist", ArtworkURL: "http://f"},
			},
			requiredSongs: 2,
			wantErr:       false,
		},
		{
			name: "duplicate title artist can make pool too small",
			songs: []Song{
				{PreviewURL: "http://a", TrackName: "Same Song", ArtistName: "Same Artist", ArtworkURL: "http://c"},
				{PreviewURL: "http://b", TrackName: "same song", ArtistName: "same artist", ArtworkURL: "http://d"},
			},
			requiredSongs: 2,
			wantErr:       true,
		},
		{
			name: "pool too large",
			songs: func() []Song {
				pool := make([]Song, 201)
				for i := range pool {
					pool[i] = Song{
						PreviewURL: fmt.Sprintf("http://%d", i),
						TrackName:  fmt.Sprintf("Track %d", i),
						ArtistName: "Artist",
						ArtworkURL: "http://art",
					}
				}
				return pool
			}(),
			requiredSongs: 2,
			wantErr:       true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := cleanSongPool(tt.songs, tt.requiredSongs)
			if (err != nil) != tt.wantErr {
				t.Errorf("cleanSongPool() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestSelectRoundSongsRespectsSameArtistCapacity(t *testing.T) {
	songs := append(testSongsForArtist("Artist A", 6), testSongsForArtist("Artist B", 3)...)
	selectedSongs, err := selectRoundSongs(songs, 3, 3)
	if err != nil {
		t.Fatalf("selectRoundSongs() unexpected error = %v", err)
	}
	if len(selectedSongs) != 3 {
		t.Fatalf("selectRoundSongs() selected %d songs, want 3", len(selectedSongs))
	}

	selectedByArtist := make(map[string]int)
	for _, song := range selectedSongs {
		selectedByArtist[song.ArtistName]++
	}
	if selectedByArtist["Artist A"] > 2 {
		t.Fatalf("Artist A selected %d rounds, want at most 2", selectedByArtist["Artist A"])
	}
	if selectedByArtist["Artist B"] > 1 {
		t.Fatalf("Artist B selected %d rounds, want at most 1", selectedByArtist["Artist B"])
	}
}

func TestSelectRoundSongsFallsBackWhenSameArtistCapacityIsLow(t *testing.T) {
	songs := append(testSongsForArtist("Artist A", 4), testSongsForArtist("Artist B", 4)...)
	selectedSongs, err := selectRoundSongs(songs, 3, 3)
	if err != nil {
		t.Fatalf("selectRoundSongs() unexpected error = %v", err)
	}
	if len(selectedSongs) != 3 {
		t.Fatalf("selectRoundSongs() selected %d songs, want 3", len(selectedSongs))
	}

	seenSongs := make(map[string]bool, len(selectedSongs))
	for _, song := range selectedSongs {
		key := normalizedSongKey(song)
		if seenSongs[key] {
			t.Fatalf("selectRoundSongs() selected duplicate song %q", key)
		}
		seenSongs[key] = true
	}
}

func TestSelectRoundSongsRejectsInsufficientTotalSongs(t *testing.T) {
	songs := testSongsForArtist("Artist A", 2)
	_, err := selectRoundSongs(songs, 3, 3)
	if err == nil {
		t.Fatal("selectRoundSongs() expected error")
	}
}

func testSongsForArtist(artistName string, count int) []Song {
	songs := make([]Song, 0, count)
	for index := 0; index < count; index++ {
		songs = append(songs, Song{
			PreviewURL: fmt.Sprintf("http://%s-%d.mp3", artistName, index),
			TrackName:  fmt.Sprintf("%s Song %d", artistName, index),
			ArtistName: artistName,
			ArtworkURL: fmt.Sprintf("http://%s-%d.jpg", artistName, index),
		})
	}
	return songs
}

func TestExtractArtistArtworkURLPrefersStructuredArtistImage(t *testing.T) {
	pageHTML := `<html><head>
		<meta property="og:image" content="https://is1-ssl.mzstatic.com/image/thumb/Features115/v4/queen.png/1200x630cw.png">
		<script id=schema:music-group type="application/ld+json">
			{"@context":"http://schema.org","@type":"MusicGroup","name":"Queen","image":"https://is1-ssl.mzstatic.com/image/thumb/Features115/v4/queen.png/486x486bb.png"}
		</script>
		</head><body>
		<img src="https://is1-ssl.mzstatic.com/image/thumb/AMCArtistImages211/v4/elton.png/486x486cc.webp">
	</body></html>`

	got := extractArtistArtworkURL(pageHTML)
	want := "https://is1-ssl.mzstatic.com/image/thumb/Features115/v4/queen.png/486x486bb.png"
	if got != want {
		t.Fatalf("extractArtistArtworkURL() = %q, want %q", got, want)
	}
}

func TestExtractArtistArtworkURLFallsBackToMetaImage(t *testing.T) {
	pageHTML := `<html><head>
		<meta property="og:image" content="https://is1-ssl.mzstatic.com/image/thumb/Features115/v4/queen.png/1200x630cw.png">
		</head><body>
		<img src="https://is1-ssl.mzstatic.com/image/thumb/AMCArtistImages211/v4/elton.png/486x486cc.webp">
	</body></html>`

	got := extractArtistArtworkURL(pageHTML)
	want := "https://is1-ssl.mzstatic.com/image/thumb/Features115/v4/queen.png/486x486bb.png"
	if got != want {
		t.Fatalf("extractArtistArtworkURL() = %q, want %q", got, want)
	}
}

func TestRateLimiter(t *testing.T) {
	rl := newRateLimiter(time.Second, 2)

	if !rl.allow("ip1") {
		t.Error("first request should be allowed")
	}
	if !rl.allow("ip1") {
		t.Error("second request should be allowed")
	}
	if rl.allow("ip1") {
		t.Error("third request should be blocked")
	}

	if !rl.allow("ip2") {
		t.Error("different ip should be allowed")
	}

	time.Sleep(time.Second + 100*time.Millisecond)
	if !rl.allow("ip1") {
		t.Error("request after window should be allowed")
	}
}

func TestSanitizeDisplayName(t *testing.T) {
	tests := []struct {
		input   string
		want    string
		wantErr bool
	}{
		{"Hello World", "Hello World", false},
		{"  spaced  ", "spaced", false},
		{"a", "", true},
		{"clean!!!name", "cleanname", false},
		{"fuck", "", true},
		{"nice person", "nice person", false},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			got, err := sanitizeDisplayName(tt.input)
			if (err != nil) != tt.wantErr {
				t.Errorf("sanitizeDisplayName(%q) error = %v, wantErr %v", tt.input, err, tt.wantErr)
				return
			}
			if got != tt.want {
				t.Errorf("sanitizeDisplayName(%q) = %q, want %q", tt.input, got, tt.want)
			}
		})
	}
}

func TestLevenshteinDistance(t *testing.T) {
	tests := []struct {
		left  string
		right string
		want  int
	}{
		{"kitten", "sitting", 3},
		{"", "abc", 3},
		{"abc", "abc", 0},
		{"ab", "ba", 2},
	}

	for _, tt := range tests {
		t.Run(tt.left+"_"+tt.right, func(t *testing.T) {
			got := levenshteinDistance(tt.left, tt.right)
			if got != tt.want {
				t.Errorf("levenshteinDistance(%q, %q) = %d, want %d", tt.left, tt.right, got, tt.want)
			}
		})
	}
}

func TestScoreGuess(t *testing.T) {
	_, points, _ := scoreGuess("hello", "hello", 10, 500, 0)
	if points != 1000 {
		t.Errorf("instant correct expected 1000, got %d", points)
	}

	_, points, _ = scoreGuess("wrong", "hello", 10, 500, 0)
	if points != 0 {
		t.Errorf("wrong guess expected 0, got %d", points)
	}

	_, points, _ = scoreGuess("hello", "hello", 10, 15000, 0)
	if points != 0 {
		t.Errorf("late guess beyond time limit expected 0, got %d", points)
	}

	_, points, _ = scoreGuess("hello", "hello", 10, 10000, 0)
	if points != 100 {
		t.Errorf("late correct at boundary expected minimum 100, got %d", points)
	}
}

func TestShuffleSongs(t *testing.T) {
	original := []Song{
		{PreviewURL: "1", TrackName: "A"},
		{PreviewURL: "2", TrackName: "B"},
		{PreviewURL: "3", TrackName: "C"},
		{PreviewURL: "4", TrackName: "D"},
		{PreviewURL: "5", TrackName: "E"},
	}

	// Statistically unlikely to stay in same order across many shuffles
	sameOrderCount := 0
	for i := 0; i < 100; i++ {
		copySlice := make([]Song, len(original))
		copy(copySlice, original)
		shuffleSongs(copySlice)

		same := true
		for j := range original {
			if original[j].PreviewURL != copySlice[j].PreviewURL {
				same = false
				break
			}
		}
		if same {
			sameOrderCount++
		}
	}

	// Probability of staying in order 100 times is astronomically low
	if sameOrderCount > 5 {
		t.Errorf("shuffle appears non-random: %d/100 stayed in order", sameOrderCount)
	}
}

func TestChoiceCountForLobby(t *testing.T) {
	// We can't easily create core.Record in tests without PocketBase app context,
	// so test the boundary logic via a helper if possible or skip for now.
}

func TestMaxPlayersForLobby(t *testing.T) {
	// Same limitation as above without a test PocketBase app instance.
}

func TestIsLobbyExpired(t *testing.T) {
	// Would need a real record; covered by integration tests ideally.
}

func BenchmarkFuzzyMatch(b *testing.B) {
	for i := 0; i < b.N; i++ {
		fuzzyMatch("hello world", "hello world")
	}
}

func BenchmarkLevenshtein(b *testing.B) {
	for i := 0; i < b.N; i++ {
		levenshteinDistance("kitten", "sitting")
	}
}
