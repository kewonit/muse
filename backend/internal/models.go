package internal

import "time"

const (
	defaultRoomTTLMinutes = 45
	expiredRoomRetention  = 6 * time.Hour
	defaultMaxPlayers     = 24
	soloMaxPlayers        = 1
	defaultChoiceCount    = 3
	minChoiceCount        = 2
	maxChoiceCount        = 5
	maxSongDuration       = 30
)

const (
	lobbyStatusWaiting  = "waiting"
	lobbyStatusPlaying  = "playing"
	lobbyStatusFinished = "finished"
)

const (
	playerStatusWaiting = "waiting"
	playerStatusPlaying = "playing"
	playerStatusDone    = "finished"
)

type Song struct {
	PreviewURL string `json:"previewUrl"`
	TrackName  string `json:"trackName"`
	ArtistName string `json:"artistName"`
	ArtworkURL string `json:"artworkUrl"`
}

type PlayerAnswer struct {
	RoundNumber int    `json:"round_number"`
	Guess       string `json:"guess"`
	ChoiceID    string `json:"choice_id"`
	TimeMS      int64  `json:"time_ms"`
	Correct     bool   `json:"correct"`
	Points      int    `json:"points"`
	IsClutch    bool   `json:"is_clutch"`
	SongName    string `json:"song_name"`
	ArtistName  string `json:"artist_name"`
	AlbumArt    string `json:"album_art"`
}

type SongChoice struct {
	ID         string `json:"id"`
	TrackName  string `json:"trackName"`
	ArtistName string `json:"artistName"`
	ArtworkURL string `json:"artworkUrl"`
	Correct    bool   `json:"-"`
}

type currentRoundResponse struct {
	Started     bool         `json:"started"`
	Finished    bool         `json:"finished"`
	RoundID     string       `json:"round_id,omitempty"`
	RoundNumber int          `json:"round_number,omitempty"`
	TotalRounds int          `json:"total_rounds,omitempty"`
	Duration    int          `json:"duration,omitempty"`
	SongURL     string       `json:"song_url,omitempty"`
	AlbumArt    string       `json:"album_art,omitempty"`
	Choices     []SongChoice `json:"choices,omitempty"`
	StartedAt   string       `json:"started_at,omitempty"`
	ServerTime  string       `json:"server_time"`
}

type guessResponse struct {
	Finished bool         `json:"finished"`
	Answer   PlayerAnswer `json:"answer"`
}
