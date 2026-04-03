const APP_TIME_ZONE = process.env.APP_TIMEZONE || "America/Bogota";

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const getDatePartsInTimeZone = (date = new Date(), timeZone = APP_TIME_ZONE) => {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error(`No se pudo obtener la fecha para la zona horaria ${timeZone}`);
  }

  return {
    year: Number(year),
    month: Number(month),
    day: Number(day),
  };
};

const toBusinessDateOnly = (date = new Date(), timeZone = APP_TIME_ZONE) => {
  const { year, month, day } = getDatePartsInTimeZone(date, timeZone);
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
};

const formatTimestampForTimeZone = (value, timeZone = APP_TIME_ZONE) => {
  const parsed = parseTimestampValue(value);
  if (!parsed) return null;

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(parsed);
  const get = (type) => parts.find((part) => part.type == type)?.value;
  const year = get("year");
  const month = get("month");
  const day = get("day");
  const hour = get("hour");
  const minute = get("minute");
  const second = get("second");

  if (!year || !month || !day || !hour || !minute || !second) return null;

  // Colombia se mantiene en UTC-05:00 todo el año.
  return `${year}-${month}-${day}T${hour}:${minute}:${second}-05:00`;
};

const parseTimestampValue = (value) => {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "string") {
    // Si es solo una fecha, sin hora
    if (DATE_ONLY_PATTERN.test(value.trim())) {
      return null;
    }

    // Para strings ISO con zona horaria (PostgreSQL timestamptz)
    // Normalizar para asegurar parsing correcto
    const trimmed = value.trim();

    try {
      const parsed = new Date(trimmed);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    } catch {
      return null;
    }
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

module.exports = {
  APP_TIME_ZONE,
  toBusinessDateOnly,
  formatTimestampForTimeZone,
  parseTimestampValue,
};
