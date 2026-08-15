function minutes(value) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

export function isWithinActiveHours(schedule, now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: schedule.timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  const minute = Number(parts.find((part) => part.type === "minute")?.value);
  const current = hour * 60 + minute;
  const start = minutes(schedule.start);
  const end = minutes(schedule.end);
  return start <= end ? current >= start && current < end : current >= start || current < end;
}
