// CSV text (RFC 4180): fields with commas, quotes or line breaks are quoted, quotes doubled.
// Cells starting with = + - @ are prefixed with ' so spreadsheet apps don't run them as formulas.
export function toCsv(rows: string[][]): string {
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

function csvCell(value: string): string {
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}
