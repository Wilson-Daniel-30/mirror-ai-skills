export function stripComment(line: string): string {
  let quote = false;
  for (let i = 0; i < line.length - 1; i++) {
    const ch = line[i];
    if (ch === "\\") {
      i++;
      continue;
    }
    if (ch === '"') quote = !quote;
    if (!quote && ch === "/" && line[i + 1] === "/") return line.slice(0, i);
  }
  return line;
}

export function excerpt(line: string): string {
  return line.trim().replace(/\s+/g, " ").slice(0, 180);
}

export function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function normPath(value: string): string {
  let path = value.trim();
  const query = path.indexOf("?");
  if (query >= 0) path = path.slice(0, query);
  if (!path.startsWith("/")) path = `/${path}`;
  path = path.replace(/\/{2,}/g, "/");
  if (path.length > 1) path = path.replace(/\/+$/, "");
  return path;
}

export function isTestPath(file: string): boolean {
  const unix = file.replaceAll("\\", "/");
  return (
    unix.includes("/src/test/") ||
    unix.includes("/src/androidTest/") ||
    unix.includes("/AppTests/") ||
    /\/[^/]*Test\.kt$/.test(unix) ||
    /\/[^/]*Tests\.swift$/.test(unix)
  );
}

export function paramNamesRelated(a: string, b: string): boolean {
  const left = a.toLowerCase().replace(/[_-]/g, "");
  const right = b.toLowerCase().replace(/[_-]/g, "");
  if (left === right) return true;
  const shorter = left.length <= right.length ? left : right;
  const longer = left.length <= right.length ? right : left;
  if (shorter.length < 4) return false;
  return longer.includes(shorter);
}

export function countChar(line: string, char: string): number {
  let count = 0;
  let quote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === "\\") {
      i++;
      continue;
    }
    if (ch === '"') quote = !quote;
    if (!quote && ch === char) count++;
  }
  return count;
}
