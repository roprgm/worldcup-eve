"use client";

import { type SVGProps, useState } from "react";

function EveLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 78 25"
      fill="none"
      role="img"
      aria-label="eve"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M77.7002 3.89551H54.0762L37.5781 24.3818H32.3486L36.5322 19.1729L51.958 0H77.7002V3.89551ZM21.0898 24.3721H0V20.4766H21.0898V24.3721ZM77.7012 20.4766V24.3721H56.6104V20.4766H77.7012ZM17.7744 14.0537H0V10.1582H17.7744V14.0537ZM77.7012 14.0537H59.9268V10.1582H77.7012V14.0537ZM34.7197 3.89551H0V0H34.7197V3.89551Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function EveLink() {
  return (
    <a href="https://vercel.com/eve" target="_blank" rel="noreferrer">
      eve
    </a>
  );
}

export function EveAttribution() {
  const [hover, setHover] = useState(false);

  return (
    <a
      href="https://vercel.com/eve"
      target="_blank"
      rel="noreferrer"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className={"text-sm text-subtle-foreground transition-colors hover:text-foreground"}
    >
      made with{" "}
      <span
        aria-hidden="true"
        style={{
          position: "relative",
          display: "inline-block",
        }}
      >
        <span
          className="text-muted-foreground"
          style={{
            display: "inline-block",
            opacity: hover ? 0 : 1,
            transform: hover ? "scale(1.4)" : "scale(1)",
            filter: hover ? "blur(2px)" : "blur(0)",
            transition: `opacity 0.5s var(--ease-geist), transform 0.75s var(--ease-geist), filter 0.5s var(--ease-geist)`,
          }}
        >
          eve
        </span>
        <EveLogo
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            height: "0.62em",
            width: "auto",
            opacity: hover ? 1 : 0,
            transform: `translate(-50%, -50%) scale(${hover ? 1 : 0.85})`,
            transition: `opacity 0.5s var(--ease-geist), transform 0.75s var(--ease-geist)`,
          }}
        />
      </span>
    </a>
  );
}
