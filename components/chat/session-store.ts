import type { HandleMessageStreamEvent, SessionState } from "eve/client";

// Eve owns the conversation history durably on the server. We keep only the
// small resume cursor — session id, continuation token (required to send the
// next turn; the server never hands it back), and stream index. It lives in
// sessionStorage, so a refresh resumes the chat and closing the tab forgets it.

const CURSOR_PREFIX = "wc26:chat:";

export function readCursor(sessionId: string): SessionState | null {
  try {
    const raw = sessionStorage.getItem(CURSOR_PREFIX + sessionId);
    return raw ? (JSON.parse(raw) as SessionState) : null;
  } catch {
    return null;
  }
}

export function writeCursor(session: SessionState): void {
  if (!session.sessionId) return;
  try {
    sessionStorage.setItem(
      CURSOR_PREFIX + session.sessionId,
      JSON.stringify(session),
    );
  } catch {
    // sessionStorage can be unavailable (private mode, quota) — losing the
    // cursor only costs resumability, so a failed write is safe to ignore.
  }
}

// Rebuild a conversation by replaying its durable event stream from the start,
// stopping once we've read the events we had last time. The cap matters because
// a parked session's stream stays open for the next turn. The stream route is
// same-origin NDJSON, so a plain fetch reads it without the Node-only client.
export async function streamHistory(
  cursor: SessionState,
  signal: AbortSignal,
): Promise<HandleMessageStreamEvent[]> {
  if (!cursor.sessionId) return [];
  const url = `/eve/v1/session/${encodeURIComponent(cursor.sessionId)}/stream?startIndex=0`;
  const response = await fetch(url, { signal });
  if (!response.ok || !response.body) return [];

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const events: HandleMessageStreamEvent[] = [];
  let buffer = "";

  try {
    while (
      cursor.streamIndex === undefined ||
      events.length < cursor.streamIndex
    ) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let newline = buffer.indexOf("\n");
      while (newline !== -1) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (line) events.push(JSON.parse(line) as HandleMessageStreamEvent);
        newline = buffer.indexOf("\n");
      }
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  return events;
}
