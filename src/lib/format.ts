export function truncateImageName(name: string, maxLength = 40): string {
  return name.length > maxLength ? `${name.slice(0, maxLength)}.....` : name;
}
