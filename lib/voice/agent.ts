// Thin client for AssemblyAI's Voice Agent API WebSocket.
// The browser never sees the API key: /api/token mints a single-use temporary token.
import { toBase64 } from "./audio";

export type AgentEvent = { type: string } & Record<string, any>;

export interface SessionConfig {
  system_prompt: string;
  greeting?: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
}

export class AgentConnection {
  private ws?: WebSocket;
  private ended?: () => void;
  ready = false;
  sessionId: string | null = null;
  onEvent: (ev: AgentEvent) => void = () => {};
  onDrop: (reason: string) => void = () => {};

  async connect(session: SessionConfig) {
    const res = await fetch("/api/token", { cache: "no-store" });
    if (!res.ok) throw new Error(`Couldn't get a session token (${res.status}). ${await res.text()}`);
    const { token } = await res.json();

    const ws = new WebSocket(`wss://agents.assemblyai.com/v1/ws?token=${encodeURIComponent(token)}`);
    this.ws = ws;
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("The voice service took too long to answer. Check your connection and try again.")), 15000);
      ws.onopen = () => ws.send(JSON.stringify({ type: "session.update", session }));
      ws.onmessage = (m) => {
        const ev = JSON.parse(m.data) as AgentEvent;
        if (ev.type === "session.ready") {
          this.ready = true;
          this.sessionId = ev.session_id;
          clearTimeout(timer);
          resolve();
        } else if (ev.type === "session.error" && !this.ready) {
          clearTimeout(timer);
          reject(new Error(`Voice session error: ${ev.message ?? ev.code}`));
        } else if (ev.type === "session.ended") {
          this.ended?.();
        }
        this.onEvent(ev);
      };
      ws.onclose = (e) => {
        clearTimeout(timer);
        if (!this.ready) reject(new Error(`The voice service closed the connection (code ${e.code}).`));
        else if (!this.endRequested) this.onDrop(`Connection lost (code ${e.code}).`);
        this.ready = false;
        this.ended?.();
      };
    });
  }

  private endRequested = false;

  private send(obj: object) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(obj));
  }

  sendAudio(pcm: ArrayBuffer) {
    if (this.ready) this.send({ type: "input.audio", audio: toBase64(pcm) });
  }

  update(session: Partial<SessionConfig>) {
    this.send({ type: "session.update", session });
  }

  reply(instructions?: string) {
    this.send(instructions ? { type: "reply.create", instructions } : { type: "reply.create" });
  }

  /** Ends the session cleanly (stops billing immediately) and waits for session.ended. */
  async end() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.endRequested = true;
    const done = new Promise<void>((r) => (this.ended = r));
    this.send({ type: "session.end" });
    await Promise.race([done, new Promise((r) => setTimeout(r, 3000))]);
    this.ws.close();
  }

  /** Synchronous variant for pagehide, where nothing async gets to finish. */
  endNow() {
    this.endRequested = true;
    this.send({ type: "session.end" });
  }
}
