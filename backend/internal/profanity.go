package internal

import "strings"

var blockedNameTerms = []string{
	"asshole",
	"bastard",
	"bitch",
	"cunt",
	"damn",
	"dick",
	"fag",
	"fuck",
	"nigger",
	"nigga",
	"piss",
	"prick",
	"pussy",
	"shit",
	"slut",
	"twat",
	"whore",
}

func containsProfanity(value string) bool {
	normalized := normalizeProfanityValue(value)
	for _, term := range blockedNameTerms {
		if strings.Contains(normalized, term) {
			return true
		}
	}
	return false
}

func normalizeProfanityValue(value string) string {
	value = strings.ToLower(value)
	replacements := map[string]string{
		"0": "o",
		"1": "i",
		"3": "e",
		"4": "a",
		"5": "s",
		"7": "t",
		"@": "a",
		"$": "s",
		"!": "i",
	}

	var builder strings.Builder
	for _, char := range value {
		text := string(char)
		if replacement, ok := replacements[text]; ok {
			builder.WriteString(replacement)
			continue
		}
		if char >= 'a' && char <= 'z' {
			builder.WriteRune(char)
		}
	}
	return builder.String()
}
