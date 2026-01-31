from faster_whisper import WhisperModel

model_size = "medium"

# Run on GPU with FP16
model = WhisperModel(model_size, device="cpu", compute_type="int8")

# or run on GPU with INT8
# model = WhisperModel(model_size, device="cuda", compute_type="int8_float16")
# or run on CPU with INT8
# model = WhisperModel(model_size, device="cpu", compute_type="int8")

segments, _ = model.transcribe("media_cache/3eytpBOkOFA.mp3", word_timestamps=True)

for segment in segments:
    print(segment)
    for word in segment.words:
        print("[%.2fs -> %.2fs] %s" % (word.start, word.end, word.word))