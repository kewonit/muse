package internal

import (
	"crypto/rand"
	"errors"
	"fmt"
	"math/big"
	"strings"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/types"
)

const maxSongPoolSize = 200

var errInsufficientSameArtistChoices = errors.New("not enough same-artist songs for the selected difficulty")

func cleanSongPool(songs []Song, requiredSongs int) ([]Song, error) {
	if len(songs) > maxSongPoolSize {
		return nil, fmt.Errorf("song pool too large")
	}

	seenPreviewURLs := make(map[string]bool, len(songs))
	seenSongTitles := make(map[string]bool, len(songs))
	cleanedSongs := make([]Song, 0, len(songs))

	for index, song := range songs {
		song.PreviewURL = strings.TrimSpace(song.PreviewURL)
		song.TrackName = strings.TrimSpace(song.TrackName)
		song.ArtistName = strings.TrimSpace(song.ArtistName)
		song.ArtworkURL = strings.TrimSpace(song.ArtworkURL)

		if song.PreviewURL == "" {
			return nil, fmt.Errorf("song %d missing previewUrl", index)
		}
		if song.TrackName == "" {
			return nil, fmt.Errorf("song %d missing trackName", index)
		}
		if song.ArtistName == "" {
			return nil, fmt.Errorf("song %d missing artistName", index)
		}
		songTitleKey := normalizedSongKey(song)
		if seenPreviewURLs[song.PreviewURL] || seenSongTitles[songTitleKey] {
			continue
		}

		seenPreviewURLs[song.PreviewURL] = true
		seenSongTitles[songTitleKey] = true
		cleanedSongs = append(cleanedSongs, song)
	}

	if len(cleanedSongs) < requiredSongs {
		return nil, fmt.Errorf("only %d unique songs available; need %d", len(cleanedSongs), requiredSongs)
	}

	return cleanedSongs, nil
}

func normalizedSongKey(song Song) string {
	return strings.ToLower(strings.TrimSpace(song.TrackName + "::" + song.ArtistName))
}

func normalizedArtistKey(artistName string) string {
	return strings.ToLower(strings.TrimSpace(artistName))
}

func createRoomRounds(app core.App, lobby *core.Record, songs []Song) ([]Song, error) {
	roundsCollection, err := app.FindCollectionByNameOrId("rounds")
	if err != nil {
		return nil, err
	}

	existingRounds, err := app.FindRecordsByFilter(
		"rounds",
		"lobby = {:lobby}",
		"",
		200,
		0,
		dbx.Params{"lobby": lobby.Id},
	)
	if err != nil {
		return nil, err
	}
	for _, roundRecord := range existingRounds {
		if err := app.Delete(roundRecord); err != nil {
			return nil, err
		}
	}

	totalRounds := lobby.GetInt("rounds_total")
	choiceCount := choiceCountForLobby(lobby)
	shuffledSongs := make([]Song, len(songs))
	copy(shuffledSongs, songs)
	shuffleSongs(shuffledSongs)

	selectedSongs, err := selectRoundSongs(shuffledSongs, totalRounds, choiceCount)
	if err != nil {
		return nil, err
	}

	for index := 0; index < totalRounds; index++ {
		song := selectedSongs[index]
		roundRecord := core.NewRecord(roundsCollection)
		roundRecord.Set("lobby", lobby.Id)
		roundRecord.Set("round_number", index+1)
		roundRecord.Set("song_url", song.PreviewURL)
		roundRecord.Set("song_name", song.TrackName)
		roundRecord.Set("artist_name", song.ArtistName)
		roundRecord.Set("album_art", song.ArtworkURL)
		roundRecord.Set("started_at", types.NowDateTime())
		roundRecord.Set("answers", map[string]any{})
		roundRecord.Set("revealed", false)

		if err := app.Save(roundRecord); err != nil {
			return nil, err
		}
	}

	return shuffledSongs, nil
}

type artistSongGroup struct {
	key      string
	songs    []Song
	capacity int
	selected int
}

func selectRoundSongs(songs []Song, totalRounds int, choiceCount int) ([]Song, error) {
	if totalRounds <= 0 {
		return nil, fmt.Errorf("room must have at least one round")
	}
	if choiceCount < minChoiceCount {
		choiceCount = defaultChoiceCount
	}

	groupedSongs := make(map[string][]Song)
	for _, song := range songs {
		key := normalizedArtistKey(song.ArtistName)
		if key == "" {
			continue
		}
		groupedSongs[key] = append(groupedSongs[key], song)
	}

	groups := make([]artistSongGroup, 0, len(groupedSongs))
	totalCapacity := 0
	for key, artistSongs := range groupedSongs {
		if len(artistSongs) < choiceCount {
			continue
		}
		shuffleSongs(artistSongs)
		capacity := len(artistSongs) / choiceCount
		totalCapacity += capacity
		groups = append(groups, artistSongGroup{
			key:      key,
			songs:    artistSongs,
			capacity: capacity,
		})
	}

	if totalCapacity < totalRounds {
		return selectFallbackRoundSongs(songs, totalRounds)
	}

	shuffleArtistGroups(groups)
	selectedSongs := make([]Song, 0, totalRounds)
	for len(selectedSongs) < totalRounds {
		progressed := false
		for index := range groups {
			if groups[index].selected >= groups[index].capacity {
				continue
			}
			selectedSongs = append(selectedSongs, groups[index].songs[groups[index].selected])
			groups[index].selected++
			progressed = true
			if len(selectedSongs) >= totalRounds {
				break
			}
		}
		if !progressed {
			break
		}
	}

	shuffleSongs(selectedSongs)
	return selectedSongs, nil
}

func selectFallbackRoundSongs(songs []Song, totalRounds int) ([]Song, error) {
	if len(songs) < totalRounds {
		return nil, fmt.Errorf("only %d unique songs available; need %d", len(songs), totalRounds)
	}

	groupedSongs := make(map[string][]Song)
	groupKeys := make([]string, 0)
	for _, song := range songs {
		key := normalizedArtistKey(song.ArtistName)
		if key == "" {
			continue
		}
		if _, ok := groupedSongs[key]; !ok {
			groupKeys = append(groupKeys, key)
		}
		groupedSongs[key] = append(groupedSongs[key], song)
	}
	if len(groupKeys) == 0 {
		return nil, fmt.Errorf("no playable songs available")
	}

	for _, key := range groupKeys {
		shuffleSongs(groupedSongs[key])
	}
	shuffleStrings(groupKeys)

	selectedSongs := make([]Song, 0, totalRounds)
	groupCursors := make(map[string]int, len(groupKeys))
	for len(selectedSongs) < totalRounds {
		progressed := false
		for _, key := range groupKeys {
			cursor := groupCursors[key]
			if cursor >= len(groupedSongs[key]) {
				continue
			}
			selectedSongs = append(selectedSongs, groupedSongs[key][cursor])
			groupCursors[key] = cursor + 1
			progressed = true
			if len(selectedSongs) >= totalRounds {
				break
			}
		}
		if !progressed {
			break
		}
	}

	if len(selectedSongs) < totalRounds {
		return nil, fmt.Errorf("only %d selectable songs available; need %d", len(selectedSongs), totalRounds)
	}

	shuffleSongs(selectedSongs)
	return selectedSongs, nil
}

func shuffleSongs(songs []Song) {
	n := len(songs)
	for i := n - 1; i > 0; i-- {
		jBig, err := rand.Int(rand.Reader, big.NewInt(int64(i+1)))
		if err != nil {
			// Fallback to deterministic swap on crypto failure (extremely unlikely)
			jBig = big.NewInt(int64(i))
		}
		j := int(jBig.Int64())
		songs[i], songs[j] = songs[j], songs[i]
	}
}

func shuffleArtistGroups(groups []artistSongGroup) {
	n := len(groups)
	for i := n - 1; i > 0; i-- {
		jBig, err := rand.Int(rand.Reader, big.NewInt(int64(i+1)))
		if err != nil {
			jBig = big.NewInt(int64(i))
		}
		j := int(jBig.Int64())
		groups[i], groups[j] = groups[j], groups[i]
	}
}

func shuffleStrings(values []string) {
	n := len(values)
	for i := n - 1; i > 0; i-- {
		jBig, err := rand.Int(rand.Reader, big.NewInt(int64(i+1)))
		if err != nil {
			jBig = big.NewInt(int64(i))
		}
		j := int(jBig.Int64())
		values[i], values[j] = values[j], values[i]
	}
}

func findRoundByNumber(app core.App, lobbyID string, roundNumber int) (*core.Record, error) {
	return app.FindFirstRecordByFilter(
		"rounds",
		"lobby = {:lobby} && round_number = {:roundNumber}",
		dbx.Params{"lobby": lobbyID, "roundNumber": roundNumber},
	)
}
