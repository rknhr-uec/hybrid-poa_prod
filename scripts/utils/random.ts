export function getRandomAmount(min = 1, max = 100_000) {
	return Math.floor(Math.random() * max) + min;
}
