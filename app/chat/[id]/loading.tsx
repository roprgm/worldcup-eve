// Empty on purpose: keeps the route's Suspense boundary so navigation commits
// instantly. The conversation renders from the in-memory agent once mounted.
export default function Loading() {
  return null;
}
