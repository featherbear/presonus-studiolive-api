const tokenCache = new Map<string, string[]>();
const TOKEN_CACHE_MAX = 4096;

/**
 * Split a path string into tokens
 * Delimiter: `.` or `/`
 * If `key` is already an array, pass through the value
 *
 * @example
 * tokenisePath('this.is.a.key') // => ['this', 'is', 'a', 'key']
 * tokenisePath('this/is/a/key') // => ['this', 'is', 'a', 'key']
 * tokenisePath(['this', 'is', 'a', 'key']) // => ['this', 'is', 'a', 'key'] // passthrough
 */
export function tokenisePath(key: string | string[]): string[] {
	if (typeof key !== "string") return key;

	const cached = tokenCache.get(key);
	if (cached) return [...cached];

	const tokens = key.includes("/") ? key.split("/") : key.split(".");

	if (tokenCache.size < TOKEN_CACHE_MAX) {
		tokenCache.set(key, tokens);
	}

	return [...tokens];
}

export function simplifyPathTokens(path: string | string[]) {
	let tokens = tokenisePath(path);
	/**
	 * Key replacements
	 */
	const slice = tokens.slice(-2);
	if (slice[0] === "dca") {
		const old = [...tokens];
		tokens = [...tokens.slice(0, -2), ...slice.slice(1)];
		logger.debug({ oldPath: old.join("."), newPath: tokens.join(".") }, "Simplified path token");
	}

	return tokens;
}
