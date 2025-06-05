import { Temporal } from "@js-temporal/polyfill";

export function computeUtcIsoStringFromLocal(
  localDateTimeString: string,
): string {
  // 1. Create a PlainDateTime from the input string.
  const plainDateTime = Temporal.PlainDateTime.from(localDateTimeString);

  // 2. Get the user's current system timezone.
  const systemTimeZone = Temporal.Now.timeZoneId();

  // 3. Attach the system timezone to the PlainDateTime to create a ZonedDateTime.
  const zonedDateTimeInLocal = plainDateTime.toZonedDateTime(systemTimeZone);

  // 4. Convert the ZonedDateTime to UTC.
  const instant = zonedDateTimeInLocal.toInstant();

  // 5. Format it as an ISO string.
  return instant.toString({ fractionalSecondDigits: 0 });
}

export function computeLocalDateTimeStringFromUtc(
  utcDateTimeString: string,
): string {
  // 1. Create an instant from the input string.
  const instant = Temporal.Instant.from(utcDateTimeString);

  // 2. Get the user's current system timezone.
  const systemTimeZone = Temporal.Now.timeZoneId();

  // 3. Attach the system timezone to the Instant to create a ZonedDateTime.
  const zonedDateTime = instant.toZonedDateTimeISO(systemTimeZone);

  // 4. Format it as a string.
  return zonedDateTime
    .toPlainDateTime()
    .toString({ fractionalSecondDigits: 0 });
}

export function computeHumanReadableDateTimeStringFromUtc(
  utcDateTimeString: string,
): string {
  // 1. Create an instant from the input string.
  const instant = Temporal.Instant.from(utcDateTimeString);

  // 2. Get the user's current system timezone.
  const systemTimeZone = Temporal.Now.timeZoneId();

  // 3. Attach the system timezone to the Instant to create a ZonedDateTime.
  const zonedDateTime = instant.toZonedDateTimeISO(systemTimeZone);

  // 4. Format it as a string.
  return zonedDateTime.toLocaleString();
}
