// Regenerate the catalogs (markets.json + group-markets.json) from the market API.
// Build-time tool, run occasionally — the token ids are stable as prices move.
// Run: bun run predictions/sync.ts

import { writeFileSync } from "node:fs";
import { groupFixture, teamById, teamCodes } from "../tournament";
import { gammaFetch, type CatalogMarket } from "./market-api";

const TAGS = ["105309", "105315"]; // group futures + tournament futures
const SERIES_ID = "11433"; // soccer-fifwc — the per-game events live here
const OUT = new URL("./markets.json", import.meta.url);
const GROUP_OUT = new URL("./group-markets.json", import.meta.url);

// Write a catalog with one array item per line: compact, but per-item git diffs.
function writeCatalog(
  target: URL,
  key: string,
  generatedAt: string,
  items: unknown[],
): void {
  const rows = items.map((item) => `    ${JSON.stringify(item)}`).join(",\n");
  writeFileSync(
    target,
    `{\n  "generatedAt": ${JSON.stringify(generatedAt)},\n  "${key}": [\n${rows}\n  ]\n}\n`,
  );
}

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase();

// The market labels teams by display name; map those back to FIFA codes, plus the
// spellings it uses differently across its futures and per-game markets.
const codeByName = new Map(
  teamCodes.map((id) => [norm(teamById[id].name), id]),
);
for (const [name, id] of [
  ["usa", "USA"],
  ["congo dr", "COD"],
  ["bosnia herzegovina", "BIH"],
  ["korea republic", "KOR"],
  ["cote d ivoire", "CIV"],
  ["cabo verde", "CPV"],
  ["ir iran", "IRN"],
] as const)
  codeByName.set(name, id);

// Tournament-future event slugs → market kind.
const FUTURE_KIND: Record<string, string> = {
  "world-cup-winner": "champion",
  "world-cup-team-to-advance-to-knockout-stages": "advance",
  "world-cup-nation-to-reach-round-of-16": "reach_r16",
  "world-cup-nation-to-reach-quarterfinals": "reach_qf",
  "world-cup-nation-to-reach-semifinals": "reach_sf",
  "world-cup-nation-to-reach-final": "reach_final",
};

// Event slug → market kind (and group, for group futures).
function classify(slug: string): { kind: string; group?: string } | null {
  const winner = slug.match(/^world-cup-group-([a-l])-winner$/);
  if (winner) return { kind: "group_winner", group: winner[1].toUpperCase() };
  const second = slug.match(/^world-cup-group-([a-l])-second-place/);
  if (second) return { kind: "group_second", group: second[1].toUpperCase() };
  return FUTURE_KIND[slug] ? { kind: FUTURE_KIND[slug] } : null;
}

interface RawMarket {
  conditionId: string;
  groupItemTitle?: string;
  outcomes: string;
  outcomePrices?: string;
  clobTokenIds: string;
  closed?: boolean;
}
interface RawEvent {
  id: string;
  slug: string;
  closed?: boolean;
  markets: RawMarket[];
}

// The Yes token of a raw market, or null if it has no parseable Yes outcome.
function yesToken(market: {
  outcomes: string;
  clobTokenIds: string;
}): string | null {
  try {
    const tokens = JSON.parse(market.clobTokenIds) as string[];
    const yes = (JSON.parse(market.outcomes) as string[]).indexOf("Yes");
    return tokens.length >= 2 && yes >= 0 ? tokens[yes] : null;
  } catch {
    return null;
  }
}

// A resolved market's final Yes price (0/1) to bake into the catalog, or
// undefined while still open — baked prices spare the runtime from querying it.
function settledPrice(
  market: RawMarket,
  eventClosed?: boolean,
): number | undefined {
  if (!market.closed && !eventClosed) return undefined;
  try {
    const yes = (JSON.parse(market.outcomes) as string[]).indexOf("Yes");
    const price = Number(
      (JSON.parse(market.outcomePrices ?? "[]") as string[])[yes],
    );
    return Number.isFinite(price) ? Math.round(price) : undefined;
  } catch {
    return undefined;
  }
}

async function getEvents(path: string): Promise<RawEvent[]> {
  const res = await gammaFetch(path);
  return res.ok ? (res.json() as Promise<RawEvent[]>) : [];
}

// Tournament/group-future events. We fetch open AND closed: a settled market
// (e.g. a decided group's second-place) sits in a closed event we still want.
async function fetchFutureEvents(): Promise<RawEvent[]> {
  const tagPaths = TAGS.flatMap((t) => [
    `/events?tag_id=${t}&closed=false&archived=false&limit=200`,
    `/events?tag_id=${t}&closed=true&archived=false&limit=200`,
  ]);
  const slugPaths = "abcdefghijkl"
    .split("")
    .map((l) => `/events?slug=world-cup-group-${l}-winner`);
  const pages = await Promise.all([...tagPaths, ...slugPaths].map(getEvents));
  return [...new Map(pages.flat().map((e) => [e.id, e])).values()]; // dedup across tags/states
}

// Stage-of-elimination events: one per team (slug = team name), each with binary
// sub-markets giving the round the team bows out in (titles → elim_* kinds).
const ELIM_KIND: Record<string, string> = {
  "Group Stage": "elim_groups",
  "Round of 32": "elim_r32",
  "Round of 16": "elim_r16",
  Quarterfinals: "elim_qf",
  Semifinals: "elim_sf",
  Final: "elim_final",
  Champion: "elim_champion",
};
const slug = (id: string) =>
  id === "USA"
    ? "usa"
    : teamById[id].name
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .replace(/[^a-z0-9]+/gi, " ")
        .trim()
        .toLowerCase()
        .replace(/ +/g, "-");

async function fetchEliminationMarkets(): Promise<CatalogMarket[]> {
  const out: CatalogMarket[] = [];
  const events = await Promise.all(
    teamCodes.map((code) =>
      getEvents(
        `/events?slug=world-cup-${slug(code)}-stage-of-elimination`,
      ).then((d) => [code, d[0]] as const),
    ),
  );
  for (const [code, event] of events) {
    if (!event) continue; // no market for this team — model falls back to reach_*
    for (const market of event.markets) {
      const kind = ELIM_KIND[market.groupItemTitle ?? ""];
      const token = yesToken(market);
      const settled = settledPrice(market, event.closed);
      if (kind && token)
        out.push({
          kind,
          code,
          conditionId: market.conditionId,
          yesToken: token,
          eventId: event.id,
          ...(settled != null ? { settled } : {}),
        });
    }
  }
  return out;
}

// Discover every futures market (no file IO, so it can be timed/tested).
export async function buildCatalog(): Promise<{
  markets: CatalogMarket[];
  unmapped: string[];
}> {
  const [futureEvents, elimMarkets] = await Promise.all([
    fetchFutureEvents(),
    fetchEliminationMarkets(),
  ]);
  const markets: CatalogMarket[] = [...elimMarkets];
  const unmapped = new Set<string>();

  for (const event of futureEvents) {
    const c = classify(event.slug);
    if (!c) continue;
    for (const market of event.markets) {
      const title = market.groupItemTitle;
      if (!title) continue;
      const code = codeByName.get(norm(title));
      const token = yesToken(market);
      const settled = settledPrice(market, event.closed);
      if (!code) {
        unmapped.add(title);
        continue;
      }
      if (token)
        markets.push({
          kind: c.kind,
          ...(c.group ? { group: c.group } : {}),
          code,
          conditionId: market.conditionId,
          yesToken: token,
          eventId: event.id,
          ...(settled != null ? { settled } : {}),
        });
    }
  }

  markets.sort(
    (a, b) =>
      a.kind.localeCompare(b.kind) ||
      (a.group ?? "").localeCompare(b.group ?? "") ||
      a.code.localeCompare(b.code),
  );
  return { markets, unmapped: [...unmapped] };
}

interface ScoreMarket {
  h: number;
  a: number;
  token: string;
}
interface GroupCatalogMatch {
  matchId: string;
  homeId: string;
  awayId: string;
  eventId: string;
  moneyline?: { home: string; away: string };
  scores: ScoreMarket[];
}
interface GameMarket {
  question?: string;
  groupItemTitle?: string;
  outcomes: string;
  clobTokenIds: string;
}
interface GameEvent {
  id: string;
  slug: string;
  closed?: boolean;
  teams?: { name: string }[];
  markets: GameMarket[];
}

const GAME_SLUG = /^fifwc-[a-z]{2,4}-[a-z]{2,4}-\d{4}-\d{2}-\d{2}$/;

// All per-game events in the series (paged), narrowed to actual game slugs.
async function fetchGameEvents(): Promise<GameEvent[]> {
  const all: GameEvent[] = [];
  for (let off = 0; off < 1500; off += 100) {
    const res = await gammaFetch(
      `/events?series_id=${SERIES_ID}&limit=100&offset=${off}`,
    );
    const page = res.ok ? ((await res.json()) as GameEvent[]) : [];
    if (!page.length) break;
    all.push(...page);
  }
  return all.filter((e) => GAME_SLUG.test(e.slug));
}

async function fetchExactScore(slug: string): Promise<GameEvent | null> {
  const res = await gammaFetch(`/events?slug=${slug}-exact-score`);
  const events = res.ok ? ((await res.json()) as GameEvent[]) : [];
  return events[0] ?? null;
}

// Per still-open group fixture: the moneyline tokens (from the game event) and
// the scoreline tokens (from its `-exact-score` sibling). Played fixtures drop
// out — their result comes from the results module, not a forecast.
export async function buildGroupCatalog(): Promise<{
  matches: GroupCatalogMatch[];
}> {
  const games = (await fetchGameEvents()).filter((e) => !e.closed);
  const matches: GroupCatalogMatch[] = [];

  for (const game of games) {
    const [a, b] = (game.teams ?? []).map((t) => codeByName.get(norm(t.name)));
    if (!a || !b) continue;
    const fixture = groupFixture(a, b);
    if (!fixture) continue; // a knockout game, not a group fixture

    // Moneyline: each team's "Will X win?" Yes token, oriented to our home/away.
    const winToken = new Map<string, string>();
    for (const m of game.markets) {
      const q = (m.question ?? "").match(
        /^Will (.+?) win on \d{4}-\d{2}-\d{2}\?$/i,
      );
      const code = q ? codeByName.get(norm(q[1])) : undefined;
      const token = code ? yesToken(m) : null;
      if (code && token) winToken.set(code, token);
    }
    const home = winToken.get(fixture.homeId);
    const away = winToken.get(fixture.awayId);
    const moneyline = home && away ? { home, away } : undefined;

    // Exact scores from the `-exact-score` sibling, oriented to our home/away.
    const exact = await fetchExactScore(game.slug);
    const scores: ScoreMarket[] = [];
    for (const m of exact?.markets ?? []) {
      const t = (m.groupItemTitle ?? "").match(
        /^(.+?)\s+(\d+)\s*-\s*(\d+)\s+(.+)$/,
      ); // "{home} h - a {away}"
      const homeId = t ? codeByName.get(norm(t[1])) : undefined;
      const tokens = JSON.parse(m.clobTokenIds || "[]") as string[];
      if (!t || !homeId || !tokens.length) continue;
      const [hg, ag] = [Number(t[2]), Number(t[3])];
      scores.push({
        h: fixture.homeId === homeId ? hg : ag,
        a: fixture.homeId === homeId ? ag : hg,
        token: tokens[0],
      });
    }

    if (moneyline || scores.length)
      matches.push({
        matchId: fixture.id,
        homeId: fixture.homeId,
        awayId: fixture.awayId,
        eventId: exact?.id ?? game.id,
        ...(moneyline ? { moneyline } : {}),
        scores,
      });
  }

  matches.sort((x, y) => x.matchId.localeCompare(y.matchId));
  return { matches };
}

// Run as a script: write both catalogs and report coverage.
if ((import.meta as { main?: boolean }).main) {
  const stamp = new Date().toISOString();

  const { markets, unmapped } = await buildCatalog();
  writeCatalog(OUT, "markets", stamp, markets);
  const settled = markets.filter((m) => m.settled != null).length;
  const kinds = [...new Set(markets.map((m) => m.kind))].sort();
  console.log(
    `Wrote markets.json: ${markets.length} markets (${settled} settled), kinds: ${kinds.join(", ")}`,
  );
  if (unmapped.length)
    console.log(`Skipped non-team outcomes: ${unmapped.join(", ")}`);
  const have = new Set(markets.map((m) => `${m.kind}:${m.code}`));
  const gaps = teamCodes.flatMap((id) =>
    ["champion", "advance", "reach_r16", "reach_qf", "reach_sf", "reach_final"]
      .filter((k) => !have.has(`${k}:${id}`))
      .map((k) => `${id}/${k}`),
  );
  console.log(
    gaps.length
      ? `WARNING missing per-team markets: ${gaps.join(", ")}`
      : "Coverage OK: all 48 teams have champion/advance/reach markets",
  );

  const { matches } = await buildGroupCatalog();
  writeCatalog(GROUP_OUT, "matches", stamp, matches);
  const withOdds = matches.filter((m) => m.moneyline).length;
  console.log(
    `Wrote group-markets.json: ${matches.length} open fixtures (${withOdds} with moneyline)`,
  );
}
