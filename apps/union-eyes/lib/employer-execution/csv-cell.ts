// A spreadsheet reads a cell that starts with = + - @ tab or CR as a formula; the external id comes from an uploaded file.
export function csvCell(value: string): string {
  const text = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}
