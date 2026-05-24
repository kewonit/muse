package internal

import (
	"crypto/rand"
	mathrand "math/rand"
)

const codeAlphabet = "abcdefghijklmnopqrstuvwxyz0123456789"

func randomCode(length int) string {
	codeBytes := make([]byte, length)

	// Try crypto/rand first for secure randomness
	randomBytes := make([]byte, length)
	if _, err := rand.Read(randomBytes); err == nil {
		for i := 0; i < length; i++ {
			codeBytes[i] = codeAlphabet[int(randomBytes[i])%len(codeAlphabet)]
		}
		return string(codeBytes)
	}

	// Fallback to math/rand if crypto/rand fails (extremely unlikely)
	for i := 0; i < length; i++ {
		codeBytes[i] = codeAlphabet[mathrand.Intn(len(codeAlphabet))]
	}
	return string(codeBytes)
}
