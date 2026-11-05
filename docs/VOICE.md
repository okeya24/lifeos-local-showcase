# Local Voice Conversation

LifeOS uses WhisperKit for on-device speech recognition and the macOS system voice for speech playback.

## macOS setup

```bash
brew install whisperkit-cli
pnpm voice
```

The first run may download a local Whisper Small model. In another terminal:

```bash
pnpm dev
```

## Interaction

1. Open Cove and click the microphone button.
2. Allow microphone access on first use.
3. Speak naturally. A pause of about 0.7 seconds submits the turn.
4. Partial subtitles update during longer speech.
5. Start speaking while Cove is answering to interrupt generation and playback.

## Privacy

- Audio is transcribed locally.
- Raw recordings are temporary and are not written to the vault.
- Only the resulting text enters conversation history.
- Microphone access starts only after an explicit click.

## Current limitations

- Uses a cascaded STT → LLM → TTS pipeline, not an end-to-end full-duplex speech model.
- First audio response remains dependent on local LLM speed.
- Wake-word mode is not implemented.
- A microphone with echo cancellation is recommended.
