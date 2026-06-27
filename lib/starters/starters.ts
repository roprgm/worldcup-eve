import { matchByNumber } from "../tournament";

// A starter is a deep link that opens a real chat already asking a question, so
// the agent runs it live and the visitor continues from there with full session
// context — a genuine fork (eve has no way to seed a session with prior history,
// so the conversation is reproduced rather than replayed). Each slug maps to the
// opening prompt; the question naturally drives the agent to the right widget.

/** The opening prompt for a starter slug, or null if the slug isn't recognized.
 *  Slugs: group-a…group-l, thirds, kickoffs (today), live, match-<n>. */
export function buildStarter(slug: string): string | null {
  const group = /^group-([a-l])$/.exec(slug);
  if (group) return `How is group ${group[1].toUpperCase()} going?`;

  if (slug === "thirds") return "Who are the best third-placed teams?";
  if (slug === "kickoffs" || slug === "today")
    return "Which matches are playing today?";
  if (slug === "live") return "Which matches are live right now?";

  const match = /^match-(\d+)$/.exec(slug);
  if (match) {
    const n = Number(match[1]);
    // Knockout matches have a prediction; group-stage matches have a result.
    if (matchByNumber[n]) return `Who's likely to win match ${n}?`;
    if (n >= 1 && n <= 104) return `How did match ${n} go?`;
  }

  return null;
}
