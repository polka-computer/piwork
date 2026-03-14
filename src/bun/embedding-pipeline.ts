import { dlopen, FFIType, ptr } from "bun:ffi";
import { join } from "node:path";

const EMBEDDING_DIMS = 512;
const DEFAULT_LANG = "en";

interface NLEmbeddingLib {
	nl_embedding_available: (lang: Buffer) => number;
	nl_embed_text: (text: Buffer, lang: Buffer, out: Buffer, maxDims: number) => number;
	nl_embed_batch: (texts: Buffer, count: number, lang: Buffer, out: Buffer, maxDims: number) => number;
}

let lib: NLEmbeddingLib | null = null;

const resolveDylibPath = (): string => {
	// In packaged app, dylib is next to the bun entry in native/
	const candidates = [
		join(import.meta.dir, "..", "native", "libNLEmbedding.dylib"),
		join(import.meta.dir, "native", "libNLEmbedding.dylib"),
		join(process.cwd(), "build", "libNLEmbedding.dylib"),
	];
	for (const candidate of candidates) {
		try {
			if (Bun.file(candidate).size > 0) return candidate;
		} catch {
			// file doesn't exist, try next
		}
	}
	return candidates[0]; // Let dlopen produce the real error
};

const ensureLib = (): NLEmbeddingLib => {
	if (lib) return lib;

	const dylibPath = resolveDylibPath();
	const { symbols } = dlopen(dylibPath, {
		nl_embedding_available: {
			args: [FFIType.ptr],
			returns: FFIType.i32,
		},
		nl_embed_text: {
			args: [FFIType.ptr, FFIType.ptr, FFIType.ptr, FFIType.i32],
			returns: FFIType.i32,
		},
		nl_embed_batch: {
			args: [FFIType.ptr, FFIType.i32, FFIType.ptr, FFIType.ptr, FFIType.i32],
			returns: FFIType.i32,
		},
	});

	lib = {
		nl_embedding_available: (lang: Buffer) => symbols.nl_embedding_available(ptr(lang)),
		nl_embed_text: (text: Buffer, lang: Buffer, out: Buffer, maxDims: number) =>
			symbols.nl_embed_text(ptr(text), ptr(lang), ptr(out), maxDims),
		nl_embed_batch: (texts: Buffer, count: number, lang: Buffer, out: Buffer, maxDims: number) =>
			symbols.nl_embed_batch(ptr(texts), count, ptr(lang), ptr(out), maxDims),
	};
	return lib;
};

const cstr = (s: string): Buffer => Buffer.from(s + "\0", "utf-8");

export const isAvailable = (): boolean => {
	try {
		const native = ensureLib();
		return native.nl_embedding_available(cstr(DEFAULT_LANG)) === 1;
	} catch {
		return false;
	}
};

export const getDimensions = (): number => EMBEDDING_DIMS;

export const embedText = (text: string, lang = DEFAULT_LANG): Float32Array | null => {
	const native = ensureLib();
	const outBuf = Buffer.alloc(EMBEDDING_DIMS * 4);
	const dims = native.nl_embed_text(cstr(text), cstr(lang), outBuf, EMBEDDING_DIMS);
	if (dims <= 0) return null;
	return new Float32Array(outBuf.buffer, outBuf.byteOffset, dims);
};

export const embedBatch = (texts: string[], lang = DEFAULT_LANG): (Float32Array | null)[] => {
	if (texts.length === 0) return [];
	const native = ensureLib();
	const outBuf = Buffer.alloc(texts.length * EMBEDDING_DIMS * 4);
	const langBuf = cstr(lang);

	// Build array of C string pointers
	const cStrings = texts.map(cstr);
	const pointerSize = 8; // 64-bit pointers
	const ptrArray = Buffer.alloc(cStrings.length * pointerSize);
	for (let i = 0; i < cStrings.length; i++) {
		const p = ptr(cStrings[i]);
		// Write pointer as BigUInt64
		ptrArray.writeBigUInt64LE(BigInt(p), i * pointerSize);
	}

	const count = native.nl_embed_batch(ptrArray, texts.length, langBuf, outBuf, EMBEDDING_DIMS);
	const results: (Float32Array | null)[] = [];
	for (let i = 0; i < texts.length; i++) {
		const offset = i * EMBEDDING_DIMS * 4;
		const vec = new Float32Array(outBuf.buffer, outBuf.byteOffset + offset, EMBEDDING_DIMS);
		// Check if the vector is all zeros (failed embedding)
		const isZero = vec.every((v) => v === 0);
		results.push(isZero ? null : vec.slice());
	}
	return results;
};
