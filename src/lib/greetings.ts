import { useEffect, useState } from "react";
import { periodName, useAmbientMinutes } from "@/lib/ambient";

export type GreetingPeriod = ReturnType<typeof periodName>;

/** The heading and the pool of messages for each part of the day (same periods as the background). */
export const GREETINGS: Record<GreetingPeriod, { title: string; messages: string[] }> = {
  Morning: {
    title: "Good morning",
    messages: [
      "Good morning! Ready to make today count?",
      "Rise and shine! Here's your dashboard for the day.",
      "Good morning. Let's start the day on a good note.",
      "A fresh day, a fresh start. Let's see what's ahead.",
      "Morning! Hope today's off to a great start.",
      "Good morning! One step at a time, you've got this.",
      "The day is yours. What are we working on today?",
      "A new day, a new opportunity to get things done.",
    ],
  },
  Afternoon: {
    title: "Good afternoon",
    messages: [
      "Good afternoon! How's your day coming along?",
      "Hope your day's going well. Here's your latest overview.",
      "Good afternoon. Let's keep the momentum going.",
      "Halfway through the day, and there's still time to make progress.",
      "Taking a quick look at how things are shaping up today?",
      "Good afternoon! Let's make the rest of today count.",
    ],
  },
  Evening: {
    title: "Good evening",
    messages: [
      "Good evening! Let's see how your day has unfolded.",
      "The day's winding down. Here's where things stand.",
      "Good evening. Time to catch up on what matters.",
      "Hope you've had a productive day. Let's check in.",
      "Evening! A good time to reflect and plan ahead.",
      "One last look at today's progress before you call it a day.",
    ],
  },
  Night: {
    title: "Good night",
    messages: [
      "Burning the midnight oil? Here's your latest overview.",
      "Still up and going? Let's see what's on your plate.",
      "The world's getting quiet. Time for a little catch-up.",
      "Late-night check-in. What still needs your attention?",
      "Another day almost in the books. See where you stand.",
    ],
  },
};

/** Index last shown per period, so opening Home twice in a row never repeats the same message. */
const lastShown: Partial<Record<GreetingPeriod, number>> = {};

export interface MessagePick {
  index: number;
  message: string;
}

/** Picks a random message other than the one shown last time. Pure: it does not record the choice. */
export function chooseMessage(period: GreetingPeriod, random: () => number = Math.random): MessagePick {
  const { messages } = GREETINGS[period];
  let index = Math.floor(random() * messages.length);
  if (messages.length > 1 && index === lastShown[period]) {
    index = (index + 1 + Math.floor(random() * (messages.length - 1))) % messages.length;
  }
  return { index, message: messages[index] ?? "" };
}

export function rememberMessage(period: GreetingPeriod, index: number): void {
  lastShown[period] = index;
}

/** Choose and record in one step (for callers that are sure the message will be shown). */
export function pickMessage(period: GreetingPeriod, random: () => number = Math.random): string {
  const pick = chooseMessage(period, random);
  rememberMessage(period, pick.index);
  return pick.message;
}

/**
 * The Home greeting: a heading for the time of day and a random message from that period's list.
 * A new message is picked each time the component appears, and again if the period changes while
 * it is open (the time tester can move the clock).
 */
export function useGreeting(): { title: string; message: string } {
  const period = periodName(useAmbientMinutes());
  const [shown, setShown] = useState(() => ({ period, ...chooseMessage(period) }));

  let current = shown;
  if (shown.period !== period) {
    // Derived during render so the heading and message always belong to the same period.
    current = { period, ...chooseMessage(period) };
    setShown(current);
  }

  // Recorded only once the message is actually on screen. (React's development mode runs
  // initialisers twice and keeps one result, so recording while choosing could remember the wrong one.)
  useEffect(() => {
    rememberMessage(current.period, current.index);
  }, [current.period, current.index]);

  return { title: GREETINGS[period].title, message: current.message };
}
