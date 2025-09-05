// Add a timeout (in milliseconds) to the given AbortSignal
export function addTimeout(
  signal: AbortSignal | undefined,
  delay: number,
): AbortSignal {
  const timeoutSignal = AbortSignal.timeout(delay);

  if (signal) {
    return AbortSignal.any([signal, timeoutSignal]);
  }

  return timeoutSignal;
}
