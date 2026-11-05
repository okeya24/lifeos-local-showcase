# LifeOS Local v0.2.0 — Voice Conversation Preview

这一版把 LifeOS 从文字对话扩展到连续的本地语音交互。

## Highlights

- Continuous microphone session
- Automatic end-of-turn detection after about 0.7 seconds of silence
- Partial subtitle refresh while the user is still speaking
- Local Chinese speech recognition with WhisperKit
- Sentence-level spoken answers using the macOS system voice
- Barge-in: speak while Cove is answering to stop generation and playback
- Echo cancellation, noise suppression and automatic gain control
- Raw audio is temporary and is not saved to the Markdown vault

## Voice setup

```bash
brew install whisperkit-cli
pnpm voice
```

Open another terminal:

```bash
pnpm dev
```

Click the microphone button in Cove and allow microphone access.

## Notes

- Optimized for Apple Silicon macOS
- Requires a working microphone
- Best experience with a headset that provides echo cancellation
- Current voice architecture is STT → local LLM → sentence TTS, not an end-to-end full-duplex speech model

## Previous release

- v0.1.0 introduced the 3D universe, Markdown notes and local AI chat
