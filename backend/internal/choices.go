package internal

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"sort"
	"strings"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/core"
)

func buildSongChoices(app core.App, lobby *core.Record, roundRecord *core.Record) ([]SongChoice, error) {
	rounds, err := app.FindRecordsByFilter(
		"rounds",
		"lobby = {:lobby}",
		"round_number",
		200,
		0,
		dbx.Params{"lobby": lobby.Id},
	)
	if err != nil {
		return nil, err
	}

	choiceCount := choiceCountForLobby(lobby)
	correctChoice := choiceFromRound(roundRecord, true)
	choices := []SongChoice{correctChoice}
	seen := map[string]bool{choiceIdentity(correctChoice): true}
	addChoice := func(choice SongChoice) {
		if len(choices) >= choiceCount {
			return
		}
		identity := choiceIdentity(choice)
		if seen[identity] {
			return
		}
		seen[identity] = true
		choices = append(choices, choice)
	}

	correctSongIdentities := make(map[string]bool, len(rounds))
	for _, candidateRound := range rounds {
		correctSongIdentities[choiceIdentity(choiceFromRound(candidateRound, false))] = true
	}

	currentArtistKey := normalizedArtistKey(roundRecord.GetString("artist_name"))
	currentArtistRoundIndex := 0
	for _, candidateRound := range rounds {
		if candidateRound.Id == roundRecord.Id {
			break
		}
		if normalizedArtistKey(candidateRound.GetString("artist_name")) == currentArtistKey {
			currentArtistRoundIndex++
		}
	}

	sameArtistSongs := make([]Song, 0)
	otherArtistSongs := make([]Song, 0)
	for _, song := range loadLobbySongPool(lobby) {
		if correctSongIdentities[normalizedSongKey(song)] {
			continue
		}
		if normalizedArtistKey(song.ArtistName) == currentArtistKey {
			sameArtistSongs = append(sameArtistSongs, song)
		} else {
			otherArtistSongs = append(otherArtistSongs, song)
		}
	}

	neededDistractors := choiceCount - 1
	if neededDistractors > 0 {
		addSongChoices(roundRecord.Id, sameArtistSongs, currentArtistRoundIndex*neededDistractors, addChoice)
	}

	if len(choices) < choiceCount && neededDistractors > 0 {
		addSongChoices(roundRecord.Id, otherArtistSongs, (roundRecord.GetInt("round_number")-1)*neededDistractors, addChoice)
	}

	if len(choices) < choiceCount {
		fallbackRounds := make([]*core.Record, 0, len(rounds))
		for _, candidateRound := range rounds {
			if candidateRound.Id == roundRecord.Id {
				continue
			}
			fallbackRounds = append(fallbackRounds, candidateRound)
		}

		sort.SliceStable(fallbackRounds, func(leftIndex int, rightIndex int) bool {
			leftHash := deterministicChoiceHash(roundRecord.Id, fallbackRounds[leftIndex])
			rightHash := deterministicChoiceHash(roundRecord.Id, fallbackRounds[rightIndex])
			return leftHash < rightHash
		})

		for _, candidateRound := range fallbackRounds {
			addChoice(choiceFromRound(candidateRound, false))
		}
	}

	sort.SliceStable(choices, func(leftIndex int, rightIndex int) bool {
		leftHash := deterministicChoiceID(roundRecord.Id, choices[leftIndex].ID)
		rightHash := deterministicChoiceID(roundRecord.Id, choices[rightIndex].ID)
		return leftHash < rightHash
	})

	return choices, nil
}

func addSongChoices(roundID string, songs []Song, startIndex int, addChoice func(SongChoice)) {
	if len(songs) == 0 {
		return
	}
	for offset := 0; offset < len(songs); offset++ {
		song := songs[(startIndex+offset)%len(songs)]
		addChoice(choiceFromSong(roundID, song, false))
	}
}

func loadLobbySongPool(lobby *core.Record) []Song {
	rawSongPool := lobby.Get("song_pool")
	if rawSongPool == nil {
		return nil
	}

	songPoolJSON, err := json.Marshal(rawSongPool)
	if err != nil {
		return nil
	}

	var songs []Song
	if err := json.Unmarshal(songPoolJSON, &songs); err != nil {
		return nil
	}

	return songs
}

func findChoice(choices []SongChoice, choiceID string) (SongChoice, bool) {
	for _, choice := range choices {
		if choice.ID == choiceID {
			return choice, true
		}
	}
	return SongChoice{}, false
}

func choiceFromRound(roundRecord *core.Record, correct bool) SongChoice {
	previewURL := roundRecord.GetString("song_url")
	return SongChoice{
		ID:         choiceID(roundRecord.Id, previewURL),
		TrackName:  roundRecord.GetString("song_name"),
		ArtistName: roundRecord.GetString("artist_name"),
		ArtworkURL: roundRecord.GetString("album_art"),
		Correct:    correct,
	}
}

func choiceFromSong(roundID string, song Song, correct bool) SongChoice {
	return SongChoice{
		ID:         choiceID(roundID, song.PreviewURL),
		TrackName:  song.TrackName,
		ArtistName: song.ArtistName,
		ArtworkURL: song.ArtworkURL,
		Correct:    correct,
	}
}

func choiceID(roundID string, previewURL string) string {
	hash := sha256.Sum256([]byte(roundID + ":" + previewURL))
	return hex.EncodeToString(hash[:])[:16]
}

func deterministicChoiceHash(seed string, roundRecord *core.Record) string {
	return deterministicChoiceID(seed, roundRecord.Id+roundRecord.GetString("song_url"))
}

func deterministicChoiceID(seed string, value string) string {
	hash := sha256.Sum256([]byte(seed + ":" + value))
	return hex.EncodeToString(hash[:])
}

func choiceIdentity(choice SongChoice) string {
	return strings.ToLower(strings.TrimSpace(choice.TrackName + "::" + choice.ArtistName))
}
