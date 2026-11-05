export function decodeRouteSegment(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}
