function toRgbChannel(channel: string) {
  return Math.round(Number(channel) * 255);
}

export function convertDisplayP3ToMapLibreRgb(color: string) {
  const displayP3ColorMatch = color.match(
    /^color\(display-p3 (?<red>\d(?:\.\d+)?) (?<green>\d(?:\.\d+)?) (?<blue>\d(?:\.\d+)?)\)$/,
  );

  if (!displayP3ColorMatch?.groups) {
    return color;
  }

  // oxlint-disable-next-line twenty/no-hardcoded-colors
  return `rgb(${toRgbChannel(displayP3ColorMatch.groups.red)}, ${toRgbChannel(
    displayP3ColorMatch.groups.green,
  )}, ${toRgbChannel(displayP3ColorMatch.groups.blue)})`;
}
