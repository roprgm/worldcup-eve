// Intentionally empty. This keeps a Suspense boundary on the route — so a
// client navigation commits instantly — but renders nothing, leaving the dark
// background while the page chunk loads. The single skeleton lives in the page
// itself (shown while React Query fetches), so there's only one to maintain.
export default function Loading() {
  return null;
}
