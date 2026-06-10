import { requireServerKey } from "@/lib/env";

export class ElevenLabsService {
  private get apiKey() {
    return requireServerKey("ELEVENLABS_API_KEY", "ElevenLabs");
  }

  async textToSpeech(text: string, voiceId?: string): Promise<ArrayBuffer> {
    const id = voiceId ?? process.env.ELEVENLABS_VOICE_ID ?? "21m00Tcm4TlvDq8ikWAM";
    const model = process.env.ELEVENLABS_TTS_MODEL ?? "eleven_multilingual_v2";

    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${id}`, {
      method: "POST",
      headers: {
        "xi-api-key": this.apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: model,
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    });
    if (!res.ok) throw new Error(`ElevenLabs TTS failed: ${res.status} ${await res.text()}`);
    return res.arrayBuffer();
  }

  async speechToText(audioBlob: Blob): Promise<string> {
    const model = process.env.ELEVENLABS_STT_MODEL ?? "scribe_v2";
    const form = new FormData();
    form.append("file", audioBlob, "audio.webm");
    form.append("model_id", model);

    const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: { "xi-api-key": this.apiKey },
      body: form,
    });
    if (!res.ok) throw new Error(`ElevenLabs STT failed: ${res.status} ${await res.text()}`);
    const data = await res.json();
    return data.text ?? data.transcript ?? "";
  }
}

export const elevenLabsService = new ElevenLabsService();
