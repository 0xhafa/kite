export type LessonActivity = {
  description: string;
  number: number;
  title: string;
};

export type StructuredLessonContent = {
  activities: LessonActivity[];
  introduction: string;
  title: string;
};

const PRINTED_WORKSHEET_LINE = /^\s*[-–—]?\s*ficha de atividade impressa(?:\s*\([^)]*\))?\.?\s*$/i;
const LESSON_TITLE_LINE = /^\s*aula\s+\d+\s*(?::|[-–—])\s*(.+?)\s*$/i;
const ACTIVITY_TITLE_LINE = /^\s*atividade(?:\s*(\d+))?\s*(?::|[-–—])\s*(.+?)\s*$/i;

function cleanLines(content: string) {
  return content
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .filter((line) => !PRINTED_WORKSHEET_LINE.test(line));
}

export function parseLessonContent(content: string): StructuredLessonContent {
  const lines = cleanLines(content);
  const firstContentLine = lines.findIndex((line) => line.trim().length > 0);
  const lessonTitleMatch =
    firstContentLine >= 0 ? lines[firstContentLine].match(LESSON_TITLE_LINE) : null;
  const title = lessonTitleMatch?.[1]?.trim() ?? "";
  const contentLines = lessonTitleMatch
    ? lines.filter((_, index) => index !== firstContentLine)
    : lines;
  const activities: LessonActivity[] = [];
  const introduction: string[] = [];
  let currentActivity: LessonActivity | undefined;

  for (const line of contentLines) {
    const activityMatch = line.match(ACTIVITY_TITLE_LINE);

    if (activityMatch) {
      currentActivity = {
        number: activityMatch[1] ? Number(activityMatch[1]) : activities.length + 1,
        title: activityMatch[2].trim(),
        description: "",
      };
      activities.push(currentActivity);
      continue;
    }

    if (currentActivity) {
      currentActivity.description = `${currentActivity.description}\n${line}`.trim();
    } else if (line.trim()) {
      introduction.push(line.trim());
    }
  }

  return {
    activities,
    introduction: introduction.join("\n").trim(),
    title,
  };
}
