"use client";

import { useState } from "react";

import { Badge, Button, Card, Progress } from "@/components/ui";
import { GenerationConfigForm } from "@/components/curriculum/generation-config";
import type { Curriculum } from "@/domain/curriculum";
import { parseLessonContent } from "@/domain/lesson-content";
import {
  emptyCurriculumSelection,
  findSelectedLesson,
  getAvailableLessons,
  getAvailableObjectives,
  getAvailableSkills,
  getAvailableWeeks,
  isCurriculumSelectionComplete,
  selectCurriculumLevel,
  type CurriculumSelection,
  type CurriculumSelectionLevel,
} from "@/domain/curriculum-navigation";

type CurriculumNavigatorProps = {
  curriculum: Curriculum;
};

type SelectionOptionProps = {
  description?: string;
  label: string;
  onSelect: () => void;
  selected: boolean;
};

function SelectionOption({
  description,
  label,
  onSelect,
  selected,
}: SelectionOptionProps) {
  return (
    <button
      aria-pressed={selected}
      className={`min-h-touch w-full rounded-lg border-2 p-4 text-left transition-[background-color,border-color,box-shadow,transform] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-focus motion-reduce:transition-none ${
        selected
          ? "border-brand bg-brand-soft shadow-raised"
          : "border-border bg-surface hover:-translate-y-0.5 hover:border-brand"
      }`}
      onClick={onSelect}
      type="button"
    >
      <span className="block font-extrabold text-ink">{label}</span>
      {description ? (
        <span className="mt-1 block text-sm font-medium leading-6 text-muted">{description}</span>
      ) : null}
    </button>
  );
}

export function CurriculumNavigator({ curriculum }: CurriculumNavigatorProps) {
  const [selection, setSelection] = useState<CurriculumSelection>(emptyCurriculumSelection);
  const [step, setStep] = useState<"curriculum" | "configuration">("curriculum");

  const skills = getAvailableSkills(curriculum, selection);
  const objectives = getAvailableObjectives(curriculum, selection);
  const weeks = getAvailableWeeks(curriculum, selection);
  const lessons = getAvailableLessons(curriculum, selection);
  const selectedLesson = findSelectedLesson(curriculum, selection);
  const selectedLessonContent = selectedLesson
    ? parseLessonContent(selectedLesson.content)
    : undefined;
  const selectedLessonTitle =
    selectedLessonContent?.title &&
    selectedLessonContent.title.trim() !== selectedLesson?.specificObjective.trim()
      ? selectedLessonContent.title
      : undefined;
  const selectionComplete = isCurriculumSelectionComplete(curriculum, selection);
  const hasMultipleWeeks = weeks.length > 1;
  const selectedLevels = [
    selection.themeId,
    selection.skillId,
    selection.objectiveId,
    ...(hasMultipleWeeks ? [selection.weekId] : []),
    selection.lessonId,
  ].filter(Boolean).length;
  const totalLevels = hasMultipleWeeks ? 5 : 4;

  function select(level: CurriculumSelectionLevel, id: string) {
    setSelection((currentSelection) => selectCurriculumLevel(currentSelection, level, id));
  }

  function selectObjective(id: string) {
    const objective = objectives.find((option) => option.id === id);

    setSelection((currentSelection) => {
      const objectiveSelection = selectCurriculumLevel(currentSelection, "objectiveId", id);
      const onlyWeek = objective?.weeks.length === 1 ? objective.weeks[0] : undefined;

      return onlyWeek
        ? selectCurriculumLevel(objectiveSelection, "weekId", onlyWeek.id)
        : objectiveSelection;
    });
  }

  if (step === "configuration" && selectedLesson) {
    return (
      <GenerationConfigForm
        lesson={selectedLesson}
        onBack={() => setStep("curriculum")}
        selection={selection}
      />
    );
  }

  return (
    <>
      <section aria-labelledby="selecao-curricular">
        <Badge tone="info">Etapa 1 · Currículo</Badge>
        <h1
          className="mt-4 max-w-3xl text-title font-black tracking-[-0.03em] sm:text-display"
          id="selecao-curricular"
        >
          Qual aula você quer planejar?
        </h1>
        <p className="mt-4 max-w-2xl text-lead font-medium text-muted">
          Escolha um item de cada vez. O conteúdo curricular é apenas consultado e permanece
          exatamente como foi definido.
        </p>
        <Card className="mt-6" padding="sm" raised={false} tone="soft">
          <Progress
            label="Caminho curricular selecionado"
            max={totalLevels}
            value={selectedLevels}
          />
        </Card>
      </section>

      <div className="mt-10 grid gap-8">
        <fieldset className="min-w-0">
          <legend className="text-xl font-black">1. Tema</legend>
          <p className="mt-1 text-sm font-medium text-muted">Tema disponível nesta POC.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {curriculum.themes.map((theme) => (
              <SelectionOption
                description={theme.description}
                key={theme.id}
                label={theme.name}
                onSelect={() => select("themeId", theme.id)}
                selected={selection.themeId === theme.id}
              />
            ))}
          </div>
        </fieldset>

        {selection.themeId ? (
          <fieldset className="min-w-0">
            <legend className="text-xl font-black">2. Habilidade</legend>
            <p className="mt-1 text-sm font-medium text-muted">
              Selecione a habilidade que será trabalhada.
            </p>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {skills.map((skill) => (
                <SelectionOption
                  description={skill.description}
                  key={skill.id}
                  label={skill.name}
                  onSelect={() => select("skillId", skill.id)}
                  selected={selection.skillId === skill.id}
                />
              ))}
            </div>
          </fieldset>
        ) : null}

        {selection.skillId ? (
          <fieldset className="min-w-0">
            <legend className="text-xl font-black">3. Objetivo</legend>
            <p className="mt-1 text-sm font-medium text-muted">
              Escolha o objetivo pertencente à habilidade.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {objectives.map((objective) => (
                <SelectionOption
                  description={objective.priorityStatement}
                  key={objective.id}
                  label={objective.name}
                  onSelect={() => selectObjective(objective.id)}
                  selected={selection.objectiveId === objective.id}
                />
              ))}
            </div>
          </fieldset>
        ) : null}

        {selection.objectiveId && hasMultipleWeeks ? (
          <fieldset className="min-w-0">
            <legend className="text-xl font-black">4. Semana</legend>
            <p className="mt-1 text-sm font-medium text-muted">
              Agora selecione a semana deste objetivo.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {weeks.map((week) => (
                <SelectionOption
                  description={week.contentSummary}
                  key={week.id}
                  label={week.title}
                  onSelect={() => select("weekId", week.id)}
                  selected={selection.weekId === week.id}
                />
              ))}
            </div>
          </fieldset>
        ) : null}

        {selection.weekId ? (
          <fieldset className="min-w-0">
            <legend className="text-xl font-black">
              {hasMultipleWeeks ? "5. Aula" : "4. Aula"}
            </legend>
            <p className="mt-1 text-sm font-medium text-muted">
              Selecione uma aula concreta para conferir o objetivo e o conteúdo.
            </p>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {lessons.map((lesson) => (
                <SelectionOption
                  description={lesson.specificObjective}
                  key={lesson.id}
                  label={`Aula ${lesson.number}`}
                  onSelect={() => select("lessonId", lesson.id)}
                  selected={selection.lessonId === lesson.id}
                />
              ))}
            </div>
          </fieldset>
        ) : null}
      </div>

      <section className="mt-10" id="aula-selecionada">
        {selectedLesson ? (
          <Card padding="lg">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Badge tone="success">Aula selecionada</Badge>
              <span className="text-sm font-extrabold text-muted">
                Aula {selectedLesson.number}
              </span>
            </div>
            <h2 className="mt-5 text-2xl font-black">Objetivo específico</h2>
            <p className="mt-3 text-lead font-bold leading-8">{selectedLesson.specificObjective}</p>
            <div className="mt-8 border-t-2 border-border pt-7">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h3 className="text-xl font-black">Atividades da aula (exemplo)</h3>
                  {selectedLessonTitle ? (
                    <p className="mt-1 font-medium leading-7 text-muted">
                      {selectedLessonTitle}
                    </p>
                  ) : null}
                </div>
                {selectedLessonContent?.activities.length ? (
                  <span className="text-sm font-extrabold text-muted">
                    {selectedLessonContent.activities.length}{" "}
                    {selectedLessonContent.activities.length === 1 ? "atividade" : "atividades"}
                  </span>
                ) : null}
              </div>

              {selectedLessonContent?.introduction ? (
                <p className="mt-4 whitespace-pre-line font-medium leading-7 text-muted">
                  {selectedLessonContent.introduction}
                </p>
              ) : null}

              {selectedLessonContent?.activities.length ? (
                <ol className="mt-5 grid gap-4">
                  {selectedLessonContent.activities.map((activity) => (
                    <li
                      className="rounded-lg border-2 border-border bg-neutral-soft p-5"
                      key={`${activity.number}-${activity.title}`}
                    >
                      <span className="text-sm font-black uppercase tracking-wide text-brand-strong">
                        Atividade {activity.number}
                      </span>
                      <h4 className="mt-1 text-lg font-black leading-7 text-ink">
                        {activity.title}
                      </h4>
                      {activity.description ? (
                        <p className="mt-3 whitespace-pre-line font-medium leading-7 text-muted">
                          {activity.description}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ol>
              ) : selectedLessonContent?.introduction ? null : (
                <p className="mt-4 font-medium leading-7 text-muted">
                  Nenhuma atividade foi detalhada para esta aula.
                </p>
              )}
            </div>
          </Card>
        ) : (
          <Card raised={false} tone="outlined">
            <h2 className="text-lg font-black">Nenhuma aula selecionada</h2>
            <p className="mt-2 font-medium leading-7 text-muted">
              Complete o caminho curricular acima para visualizar uma aula concreta.
            </p>
          </Card>
        )}
      </section>

      <div className="mt-8 border-t-2 border-border pt-6">
        <Button
          aria-describedby="orientacao-avanco"
          disabled={!selectionComplete}
          fullWidth
          onClick={() => setStep("configuration")}
          size="lg"
        >
          Avançar para configuração
        </Button>
        <p className="mt-3 text-center text-sm font-medium text-muted" id="orientacao-avanco">
          {selectionComplete
            ? "A aula está definida. Avance para configurar o grupo."
            : "Selecione uma aula para liberar o avanço."}
        </p>
      </div>
    </>
  );
}
