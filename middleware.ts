import { next } from "@vercel/functions";

const corsHeaders = {
  "access-control-allow-headers":
    "authorization, content-type, x-vercel-protection-bypass",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-origin": "*",
  "access-control-expose-headers":
    "x-eve-session-id, x-eve-stream-format, x-eve-stream-version",
  "access-control-max-age": "86400",
};

export default function middleware(request: Request) {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  return next({ headers: corsHeaders });
}

export const config = {
  matcher: "/eve/v1/:path*",
};
