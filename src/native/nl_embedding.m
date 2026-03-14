#import <NaturalLanguage/NaturalLanguage.h>

// Returns 1 if NLEmbedding word model is available for the given language, 0 if not.
int nl_embedding_available(const char *lang) {
    @autoreleasepool {
        NSString *language = [NSString stringWithUTF8String:lang];
        NLEmbedding *embedding = [NLEmbedding wordEmbeddingForLanguage:language];
        return embedding != nil ? 1 : 0;
    }
}

// Embed single text. Writes to out_vector, returns dimension count or -1 on error.
int nl_embed_text(const char *text, const char *lang, float *out_vector, int max_dims) {
    @autoreleasepool {
        NSString *language = [NSString stringWithUTF8String:lang];
        NLEmbedding *embedding = [NLEmbedding sentenceEmbeddingForLanguage:language];
        if (!embedding) {
            // Fall back to word embedding
            embedding = [NLEmbedding wordEmbeddingForLanguage:language];
        }
        if (!embedding) return -1;

        NSString *nsText = [NSString stringWithUTF8String:text];
        NSArray<NSNumber *> *vector = [embedding vectorForString:nsText];
        if (!vector || vector.count == 0) return -1;

        int dims = (int)vector.count;
        if (dims > max_dims) dims = max_dims;
        for (int i = 0; i < dims; i++) {
            out_vector[i] = vector[i].floatValue;
        }
        return dims;
    }
}

// Embed batch of texts. out_vectors is pre-allocated float buffer (count * max_dims).
// Returns number of texts successfully embedded.
int nl_embed_batch(const char **texts, int count, const char *lang, float *out_vectors, int max_dims) {
    @autoreleasepool {
        NSString *language = [NSString stringWithUTF8String:lang];
        NLEmbedding *embedding = [NLEmbedding sentenceEmbeddingForLanguage:language];
        if (!embedding) {
            embedding = [NLEmbedding wordEmbeddingForLanguage:language];
        }
        if (!embedding) return 0;

        int success = 0;
        for (int i = 0; i < count; i++) {
            NSString *nsText = [NSString stringWithUTF8String:texts[i]];
            NSArray<NSNumber *> *vector = [embedding vectorForString:nsText];
            float *dest = out_vectors + (i * max_dims);
            if (vector && vector.count > 0) {
                int dims = (int)vector.count;
                if (dims > max_dims) dims = max_dims;
                for (int j = 0; j < dims; j++) {
                    dest[j] = vector[j].floatValue;
                }
                // Zero remaining dims
                for (int j = dims; j < max_dims; j++) {
                    dest[j] = 0.0f;
                }
                success++;
            } else {
                // Zero the entire row on failure
                for (int j = 0; j < max_dims; j++) {
                    dest[j] = 0.0f;
                }
            }
        }
        return success;
    }
}
