const ACTIVE_STATUS_VALUES = new Set([
  "active",
  "activo",
  "activos",
  "true",
  "1",
]);

const INACTIVE_STATUS_VALUES = new Set([
  "inactive",
  "inactivo",
  "inactivos",
  "annulled",
  "anulado",
  "anulados",
  "false",
  "0",
]);

function parseStatusFilter(value) {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();

  if (!normalized || normalized === "all" || normalized === "todo" || normalized === "todos") {
    return null;
  }

  if (ACTIVE_STATUS_VALUES.has(normalized)) return true;
  if (INACTIVE_STATUS_VALUES.has(normalized)) return false;

  return null;
}

function buildStatusWhere(value, field = "estado") {
  const parsedStatus = parseStatusFilter(value);
  return parsedStatus === null ? {} : { [field]: parsedStatus };
}

module.exports = {
  parseStatusFilter,
  buildStatusWhere,
};
