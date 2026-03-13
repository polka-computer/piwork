const ENCODING = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // Crockford base32

const encodeTime = (now: number, len: number): string => {
	let str = "";
	for (let i = len; i > 0; i--) {
		str = ENCODING[now % 32] + str;
		now = Math.floor(now / 32);
	}
	return str;
};

const encodeRandom = (len: number): string => {
	let str = "";
	const bytes = crypto.getRandomValues(new Uint8Array(len));
	for (let i = 0; i < len; i++) {
		str += ENCODING[bytes[i] % 32];
	}
	return str;
};

export const ulid = (): string => encodeTime(Date.now(), 10) + encodeRandom(16);
