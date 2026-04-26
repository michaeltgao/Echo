// Visual treatment per action_type. Source of truth for feed cards, theme
// chips, and any other surface that color-codes actions. Mirrors the table in
// docs/briefing-p3.md.

import type { ActionType } from "./types/sse";

export interface ActionStyle {
  label: string;
  color: string; // tailwind base color (e.g. "orange") for class composition
  bg: string; // tailwind class — soft fill for the badge
  border: string; // tailwind class — left accent / border
  text: string; // tailwind class — accent text color
  showInFeed: boolean;
  hasContent: boolean;
}

export const ACTION_STYLE: Record<ActionType, ActionStyle> = {
  VENT_TO_PEER: {
    label: "Vented to peer",
    color: "orange",
    bg: "bg-orange-500/10",
    border: "border-l-orange-500",
    text: "text-orange-300",
    showInFeed: true,
    hasContent: true,
  },
  POST_IN_CHANNEL: {
    label: "Posted in channel",
    color: "red",
    bg: "bg-red-500/10",
    border: "border-l-red-500",
    text: "text-red-300",
    showInFeed: true,
    hasContent: true,
  },
  MESSAGE_MANAGER: {
    label: "Messaged manager",
    color: "blue",
    bg: "bg-blue-500/10",
    border: "border-l-blue-500",
    text: "text-blue-300",
    showInFeed: true,
    hasContent: true,
  },
  REQUEST_EXCEPTION: {
    label: "Requested exception",
    color: "yellow",
    bg: "bg-yellow-500/10",
    border: "border-l-yellow-500",
    text: "text-yellow-300",
    showInFeed: true,
    hasContent: true,
  },
  ADVOCATE: {
    label: "Advocated",
    color: "green",
    bg: "bg-emerald-500/10",
    border: "border-l-emerald-500",
    text: "text-emerald-300",
    showInFeed: true,
    hasContent: true,
  },
  UPDATE_LINKEDIN: {
    label: "Updated LinkedIn",
    color: "purple",
    bg: "bg-purple-500/10",
    border: "border-l-purple-500",
    text: "text-purple-300",
    showInFeed: true,
    hasContent: false,
  },
  GO_QUIET: {
    label: "Went quiet",
    color: "gray",
    bg: "bg-neutral-500/10",
    border: "border-l-neutral-500",
    text: "text-neutral-400",
    showInFeed: true,
    hasContent: false,
  },
  DO_NOTHING: {
    label: "No activity",
    color: "gray",
    bg: "bg-transparent",
    border: "border-l-transparent",
    text: "text-neutral-500",
    showInFeed: false,
    hasContent: false,
  },
};

// Templated description for content-less actions, used by the feed when
// action.content is empty.
export function describeContentlessAction(
  actionType: ActionType,
  agentFirstName: string,
): string {
  switch (actionType) {
    case "UPDATE_LINKEDIN":
      return `${agentFirstName} updated their LinkedIn profile.`;
    case "GO_QUIET":
      return `${agentFirstName} went silent — no posts, messages, or replies.`;
    case "DO_NOTHING":
      return `${agentFirstName} didn't react today.`;
    default:
      return "";
  }
}

// Initials helper — "Priya Krishnamurthy" → "PK"
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}
