import { parseActivityDescription } from "@/domain/activity-description";

export function ActivityDescription({ description }: { description: string }) {
  const paragraphs = parseActivityDescription(description);

  return (
    <div className="mt-4 max-w-3xl space-y-4 font-medium leading-7 text-muted">
      {paragraphs.map(({ label, text }, index) => (
        <p className="whitespace-pre-line" key={`${label ?? "paragrafo"}-${index}`}>
          {label ? <strong className="font-extrabold text-ink">{label}: </strong> : null}
          {text}
        </p>
      ))}
    </div>
  );
}
