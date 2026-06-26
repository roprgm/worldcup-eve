// Empty on purpose: keeps the route's Suspense boundary (instant navigation)
// but shows nothing. Each widget renders its own skeleton while it loads.
export default function Loading() {
  return null;
}
