package internal

import (
	"math"
	"strings"
	"unicode"
)

func scoreGuess(guess string, target string, durationSeconds int, elapsedMS int64, streak int) (bool, int, bool) {
	effectiveDuration := effectiveSongDuration(durationSeconds)
	timeLimitMS := int64(effectiveDuration) * 1000
	correct := elapsedMS <= timeLimitMS && fuzzyMatch(guess, target)
	if !correct {
		return false, 0, false
	}

	points, isClutch := scoreChoice(true, effectiveDuration, elapsedMS, streak)
	return true, points, isClutch
}

func scoreChoice(correct bool, durationSeconds int, elapsedMS int64, streak int) (int, bool) {
	if !correct {
		return 0, false
	}

	durationSeconds = effectiveSongDuration(durationSeconds)
	if elapsedMS > int64(durationSeconds)*1000 {
		return 0, false
	}

	elapsedSeconds := math.Min(float64(elapsedMS)/1000, float64(durationSeconds))
	basePoints := 1000.0
	if durationSeconds > 1 && elapsedSeconds > 1 {
		decayWindow := float64(durationSeconds - 1)
		decay := (1000 - 100) * (elapsedSeconds - 1) / decayWindow
		basePoints = math.Max(100, 1000-decay)
	}

	multiplier := 1.0
	if streak >= 5 {
		multiplier = 1.5
	} else if streak >= 3 {
		multiplier = 1.2
	}

	isClutch := elapsedSeconds > float64(durationSeconds)-0.5
	return int(math.Round(basePoints * multiplier)), isClutch
}

func effectiveSongDuration(durationSeconds int) int {
	if durationSeconds < 1 {
		return 1
	}
	if durationSeconds > maxSongDuration {
		return maxSongDuration
	}
	return durationSeconds
}

func fuzzyMatch(guess string, target string) bool {
	normalizedGuess := normalizeTitle(guess)
	normalizedTarget := normalizeTitle(target)

	if normalizedGuess == "" || normalizedTarget == "" {
		return false
	}
	if normalizedGuess == normalizedTarget {
		return true
	}
	if len(normalizedGuess) >= 3 && strings.Contains(normalizedTarget, normalizedGuess) {
		return true
	}
	if len(normalizedGuess) > 4 && levenshteinDistance(normalizedGuess, normalizedTarget) <= 2 {
		return true
	}

	return false
}

func normalizeTitle(value string) string {
	value = strings.ToLower(value)
	value = strings.ReplaceAll(value, "’", "'")

	var builder strings.Builder
	builder.Grow(len(value))
	for _, char := range value {
		if unicode.IsLetter(char) || unicode.IsNumber(char) || char == ' ' {
			builder.WriteRune(char)
		}
	}

	return strings.Join(strings.Fields(builder.String()), " ")
}

func levenshteinDistance(left string, right string) int {
	if len(left) < len(right) {
		left, right = right, left
	}
	if len(right) == 0 {
		return len(left)
	}

	previousRow := make([]int, len(right)+1)
	for column := 0; column <= len(right); column++ {
		previousRow[column] = column
	}

	for row := 1; row <= len(left); row++ {
		currentRow := make([]int, len(right)+1)
		currentRow[0] = row

		for column := 1; column <= len(right); column++ {
			substitutionCost := 0
			if left[row-1] != right[column-1] {
				substitutionCost = 1
			}

			currentRow[column] = min(
				previousRow[column]+1,
				currentRow[column-1]+1,
				previousRow[column-1]+substitutionCost,
			)
		}

		previousRow = currentRow
	}

	return previousRow[len(right)]
}
