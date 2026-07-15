export const ACTIVITY_SECTION_LABELS = [
  "Recursos",
  "Preparação",
  "Apresentação",
  "Ações",
  "Transição e encerramento",
] as const;

export type ActivitySectionLabel = (typeof ACTIVITY_SECTION_LABELS)[number];

export type ActivityDescriptionParagraph = {
  label?: ActivitySectionLabel;
  text: string;
};

const sectionLabelPattern = new RegExp(
  String.raw`(?:\*\*)?(${ACTIVITY_SECTION_LABELS.join("|")})(?:\*\*)?\s*:\s*(?:\*\*)?\s*`,
  "giu",
);

const labelsByNormalizedText = new Map(
  ACTIVITY_SECTION_LABELS.map((label) => [label.toLocaleLowerCase("pt-BR"), label]),
);

function appendUnlabeledParagraphs(
  paragraphs: ActivityDescriptionParagraph[],
  text: string,
): void {
  for (const paragraph of text.split(/\n\s*\n/u)) {
    const normalized = paragraph.trim();
    if (normalized) paragraphs.push({ text: normalized });
  }
}

export function parseActivityDescription(
  description: string,
): ActivityDescriptionParagraph[] {
  const paragraphs: ActivityDescriptionParagraph[] = [];
  const matches = [...description.matchAll(sectionLabelPattern)];

  if (matches.length === 0) {
    appendUnlabeledParagraphs(paragraphs, description);
    return paragraphs;
  }

  appendUnlabeledParagraphs(paragraphs, description.slice(0, matches[0].index));

  matches.forEach((match, index) => {
    const label = labelsByNormalizedText.get(match[1].toLocaleLowerCase("pt-BR"));
    const start = (match.index ?? 0) + match[0].length;
    const end = matches[index + 1]?.index ?? description.length;
    const text = description.slice(start, end).trim();

    if (label && text) paragraphs.push({ label, text });
  });

  return paragraphs;
}

export function formatActivityDescription(description: string): string {
  return parseActivityDescription(description)
    .map(({ label, text }) => (label ? `${label}: ${text}` : text))
    .join("\n\n");
}
