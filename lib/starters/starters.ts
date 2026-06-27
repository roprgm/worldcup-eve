import type { EveMessageData, UseEveAgentHelpers } from "eve/react";
import { matchByNumber } from "../tournament";

// Starter chats are built on the fly by parsing the slug — no storage. Each maps
// to one "show" widget tool, hand-written so the answer stays terse. The widgets
// self-fetch live data from their input alone, so the tool output can be empty.

type Events = UseEveAgentHelpers<EveMessageData>["events"];
type StreamEvent = Events[number];

// The prior events render the conversation; the transcript is replayed as model
// context so a continued chat keeps continuity (a fresh session has no history).
export type StarterSeed = {
  events: Events;
  transcript: string;
};

type WidgetSpec = {
  question: string;
  answer: string;
  toolName: string;
  input: Record<string, unknown>;
  // One line describing what was shown, replayed as model context for follow-ups.
  summary: string;
};

// The minimal event sequence the message reducer turns into a user message plus
// an assistant turn that calls one show_* tool (→ widget) and one short line.
function widgetEvents(slug: string, spec: WidgetSpec): StreamEvent[] {
  const turnId = `starter-${slug}`;
  const callId = `${turnId}-show`;
  return [
    {
      type: "message.received",
      data: { message: spec.question, sequence: 0, turnId },
    },
    { type: "step.started", data: { sequence: 1, stepIndex: 0, turnId } },
    {
      type: "actions.requested",
      data: {
        actions: [
          {
            kind: "tool-call",
            callId,
            toolName: spec.toolName,
            input: spec.input,
          },
        ],
        sequence: 2,
        stepIndex: 0,
        turnId,
      },
    },
    {
      type: "action.result",
      data: {
        result: {
          kind: "tool-result",
          callId,
          toolName: spec.toolName,
          output: {},
        },
        sequence: 3,
        stepIndex: 0,
        status: "completed",
        turnId,
      },
    },
    {
      type: "message.completed",
      data: {
        finishReason: "stop",
        message: spec.answer,
        sequence: 4,
        stepIndex: 0,
        turnId,
      },
    },
    { type: "turn.completed", data: { sequence: 5, turnId } },
  ] as StreamEvent[];
}

function widgetStarter(slug: string, spec: WidgetSpec): StarterSeed {
  return {
    events: widgetEvents(slug, spec),
    transcript: `User: ${spec.question}\n\nAssistant: ${spec.answer} (${spec.summary})`,
  };
}

/** Build a starter chat from its slug, or null if the slug isn't recognized.
 *  Slugs: group-a…group-l, thirds, kickoffs (today), live, match-<n>. */
export function buildStarter(slug: string): StarterSeed | null {
  const group = /^group-([a-l])$/.exec(slug);
  if (group) {
    const letter = group[1].toUpperCase();
    return widgetStarter(slug, {
      question: `How is group ${letter} going?`,
      answer: `Here is Group ${letter}:`,
      toolName: "show_group_standings",
      input: { group: letter },
      summary: `showed the live Group ${letter} standings — points, goal difference, and predicted finish per team`,
    });
  }

  if (slug === "thirds") {
    return widgetStarter(slug, {
      question: "Who are the best third-placed teams?",
      answer: "Best third-placed teams:",
      toolName: "show_thirds_ranking",
      input: {},
      summary:
        "showed the twelve third-placed teams ranked by their chance of reaching the Round of 32",
    });
  }

  if (slug === "kickoffs" || slug === "today") {
    return widgetStarter(slug, {
      question: "What's kicking off today?",
      answer: "Today's matches:",
      toolName: "show_matches",
      input: { scope: "today" },
      summary: "showed cards for today's matches with scores and kickoff times",
    });
  }

  if (slug === "live") {
    return widgetStarter(slug, {
      question: "Which matches are live right now?",
      answer: "Live right now:",
      toolName: "show_matches",
      input: { scope: "live" },
      summary: "showed cards for the matches currently in progress",
    });
  }

  const match = /^match-(\d+)$/.exec(slug);
  if (match) {
    const n = Number(match[1]);
    // Knockout matches have a prediction widget; group-stage matches show a card.
    if (matchByNumber[n]) {
      return widgetStarter(slug, {
        question: `Who's likely to win match ${n}?`,
        answer: `Match ${n} prediction:`,
        toolName: "show_knockout_match",
        input: { id: n },
        summary: `showed the predicted result for knockout match ${n}`,
      });
    }
    if (n >= 1 && n <= 104) {
      return widgetStarter(slug, {
        question: `How did match ${n} go?`,
        answer: `Match ${n}:`,
        toolName: "show_matches",
        input: { matches: [n] },
        summary: `showed the card for match ${n}`,
      });
    }
  }

  return null;
}
