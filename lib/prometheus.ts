export type Sample = {
  name: string;
  labels: Record<string, string>;
  value: number;
};

const SAMPLE_LINE =
  /^([a-zA-Z_:][a-zA-Z0-9_:]*)(\{([^}]*)\})?\s+(-?[\d.eE+]+)$/;
const LABEL_PAIR = /^\s*([^=]+)="(.*)"\s*$/;

export function parsePrometheus(text: string): Sample[] {
  const samples: Sample[] = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(SAMPLE_LINE);
    if (!match) continue;
    const labels: Record<string, string> = {};
    if (match[3]) {
      for (const pair of match[3].split(",")) {
        const kv = pair.match(LABEL_PAIR);
        if (kv) labels[kv[1]] = kv[2];
      }
    }
    const value = Number(match[4]);
    if (Number.isFinite(value)) samples.push({ name: match[1], labels, value });
  }
  return samples;
}

export function groupByLabel(
  samples: Sample[],
  metricName: string,
  labelName: string,
): Record<string, number> {
  const grouped: Record<string, number> = {};
  for (const sample of samples) {
    if (sample.name !== metricName) continue;
    const key = sample.labels[labelName] ?? "unlabelled";
    grouped[key] = (grouped[key] ?? 0) + sample.value;
  }
  return grouped;
}

export function singleValue(
  samples: Sample[],
  metricName: string,
): number | null {
  const match = samples.find((sample) => sample.name === metricName);
  return match ? match.value : null;
}
