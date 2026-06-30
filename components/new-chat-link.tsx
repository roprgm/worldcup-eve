"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { useChatNav } from "@/components/chat/chat-context";

/** A link to the home / new-chat screen that discards the active chat first, so
 *  going home always starts fresh. */
export function NewChatLink({
  onClick,
  ...props
}: ComponentProps<typeof Link>) {
  const { clear } = useChatNav();
  return (
    <Link
      {...props}
      onClick={(event) => {
        clear();
        onClick?.(event);
      }}
    />
  );
}
