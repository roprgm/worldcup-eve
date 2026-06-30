import {
  OG_ALT,
  OG_CONTENT_TYPE,
  OG_SIZE,
  renderDailyImage,
  todayKey,
} from "@/lib/og/daily-image";

// Regenerate the image hourly so live scores stay fresh for direct visitors.
export const revalidate = 3600;

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = OG_ALT;

// A per-day id makes the og:image URL change every FIFA day, so social crawlers
// fetch a fresh image instead of serving a stale cached one.
export function generateImageMetadata() {
  return [{ id: todayKey(), size, contentType, alt }];
}

export default function Image() {
  return renderDailyImage();
}
