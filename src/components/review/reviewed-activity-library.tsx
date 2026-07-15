"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";

import { deleteBatchAction } from "@/app/actions";
import type { ReviewedActivityLibraryBatch } from "@/server/generation/integrated-flow";

import { ActivityDescription } from "../activity-description";
import { Badge, Button, Card, Modal } from "../ui";

const DELETE_CONFIRMATION = "deletar";
const selectClassName =
  "mt-2 min-h-touch w-full rounded-md border-2 border-border bg-surface px-3 py-2 font-bold text-ink focus:border-focus focus:outline-none focus:ring-2 focus:ring-focus/20";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "America/Recife",
});

type BatchStatusFilter = "all" | "completed" | "in_progress";

type FilterOption = {
  id: string;
  label: string;
};

function uniqueOptions(
  batches: readonly ReviewedActivityLibraryBatch[],
  select: (batch: ReviewedActivityLibraryBatch) => FilterOption,
): FilterOption[] {
  const options = new Map<string, string>();

  for (const batch of batches) {
    const option = select(batch);
    options.set(option.id, option.label);
  }

  return [...options].map(([id, label]) => ({ id, label })).sort((left, right) =>
    left.label.localeCompare(right.label, "pt-BR"),
  );
}

function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("pt-BR");
}

export function ReviewedActivityLibrary({
  initialBatches,
}: {
  initialBatches: ReviewedActivityLibraryBatch[];
}) {
  const router = useRouter();
  const [batches, setBatches] = useState(initialBatches);
  const [query, setQuery] = useState("");
  const [themeId, setThemeId] = useState("");
  const [skillId, setSkillId] = useState("");
  const [objectiveId, setObjectiveId] = useState("");
  const [weekId, setWeekId] = useState("");
  const [lessonId, setLessonId] = useState("");
  const [status, setStatus] = useState<BatchStatusFilter>("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ReviewedActivityLibraryBatch>();
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [deletePending, startDeleteTransition] = useTransition();
  const confirmationInputRef = useRef<HTMLInputElement>(null);

  const reviewedBatches = useMemo(
    () => batches.filter(({ reviewedActivities }) => reviewedActivities.length > 0),
    [batches],
  );
  const reviewedActivityCount = useMemo(
    () => reviewedBatches.reduce(
      (total, batch) => total + batch.reviewedActivities.length,
      0,
    ),
    [reviewedBatches],
  );
  const pendingBatch = batches.find(({ completed }) => !completed);

  const themeOptions = useMemo(
    () => uniqueOptions(reviewedBatches, ({ theme }) => ({ id: theme.id, label: theme.name })),
    [reviewedBatches],
  );
  const batchesForSkills = reviewedBatches.filter(
    (batch) => !themeId || batch.theme.id === themeId,
  );
  const skillOptions = uniqueOptions(batchesForSkills, ({ skill }) => ({
    id: skill.id,
    label: skill.name,
  }));
  const batchesForObjectives = batchesForSkills.filter(
    (batch) => !skillId || batch.skill.id === skillId,
  );
  const objectiveOptions = uniqueOptions(batchesForObjectives, ({ objective }) => ({
    id: objective.id,
    label: objective.name,
  }));
  const batchesForWeeks = batchesForObjectives.filter(
    (batch) => !objectiveId || batch.objective.id === objectiveId,
  );
  const weekOptions = uniqueOptions(batchesForWeeks, ({ week }) => ({
    id: week.id,
    label: week.title,
  }));
  const batchesForLessons = batchesForWeeks.filter(
    (batch) => !weekId || batch.week.id === weekId,
  );
  const lessonOptions = uniqueOptions(batchesForLessons, ({ lesson }) => ({
    id: lesson.id,
    label: `Aula ${lesson.number} — ${lesson.specificObjective}`,
  }));

  const normalizedQuery = normalizeSearch(query.trim());
  const filteredBatches = reviewedBatches.filter((batch) => {
    if (themeId && batch.theme.id !== themeId) return false;
    if (skillId && batch.skill.id !== skillId) return false;
    if (objectiveId && batch.objective.id !== objectiveId) return false;
    if (weekId && batch.week.id !== weekId) return false;
    if (lessonId && batch.lesson.id !== lessonId) return false;
    if (status === "completed" && !batch.completed) return false;
    if (status === "in_progress" && batch.completed) return false;

    if (!normalizedQuery) return true;

    const searchableText = [
      batch.theme.name,
      batch.skill.name,
      batch.objective.name,
      batch.week.title,
      batch.lesson.specificObjective,
      ...batch.reviewedActivities.flatMap(({ activity, decision }) => [
        activity.title,
        activity.description,
        decision.feedback ?? "",
      ]),
    ].join(" ");

    return normalizeSearch(searchableText).includes(normalizedQuery);
  });
  const filteredActivityCount = filteredBatches.reduce(
    (total, batch) => total + batch.reviewedActivities.length,
    0,
  );
  const hasActiveFilters = Boolean(
    query || themeId || skillId || objectiveId || weekId || lessonId || status !== "all",
  );
  const activeFilterCount = [
    query,
    themeId,
    skillId,
    objectiveId,
    weekId,
    lessonId,
    status !== "all" ? status : "",
  ].filter(Boolean).length;

  function clearFilters() {
    setQuery("");
    setThemeId("");
    setSkillId("");
    setObjectiveId("");
    setWeekId("");
    setLessonId("");
    setStatus("all");
  }

  function openDeleteModal(batch: ReviewedActivityLibraryBatch) {
    setDeleteTarget(batch);
    setDeleteConfirmation("");
    setDeleteError("");
  }

  function closeDeleteModal() {
    if (deletePending) return;
    setDeleteTarget(undefined);
    setDeleteConfirmation("");
    setDeleteError("");
  }

  function confirmDelete() {
    if (!deleteTarget || deleteConfirmation !== DELETE_CONFIRMATION) return;

    const batchId = deleteTarget.batchId;
    setDeleteError("");
    startDeleteTransition(async () => {
      const result = await deleteBatchAction({
        batchId,
        confirmation: deleteConfirmation,
      });

      if (!result.ok) {
        setDeleteError(result.message);
        return;
      }

      setBatches((current) => current.filter((batch) => batch.batchId !== batchId));
      setDeleteTarget(undefined);
      setDeleteConfirmation("");
      setAnnouncement("Lote deletado permanentemente.");
      router.refresh();
    });
  }

  return (
    <>
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {reviewedActivityCount > 0 ? (
        <>
          <Card className="mt-8" padding="md" raised={false} tone="outlined">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-black">Filtrar biblioteca</h2>
                <p className="mt-1 text-sm font-medium text-muted">
                  Combine os campos para encontrar um lote ou uma atividade.
                </p>
                {hasActiveFilters ? (
                  <p className="mt-2 text-sm font-extrabold text-brand-strong">
                    {activeFilterCount} {activeFilterCount === 1 ? "filtro ativo" : "filtros ativos"}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {hasActiveFilters ? (
                  <Button onClick={clearFilters} size="sm" variant="ghost">
                    Limpar filtros
                  </Button>
                ) : null}
                <Button
                  aria-controls="opcoes-filtro-biblioteca"
                  aria-expanded={filtersOpen}
                  onClick={() => setFiltersOpen((open) => !open)}
                  size="sm"
                  variant="secondary"
                >
                  {filtersOpen ? "Ocultar filtros" : "Mostrar filtros"}
                  <span
                    aria-hidden="true"
                    className={`text-base transition-transform ${filtersOpen ? "rotate-180" : ""}`}
                  >
                    ↓
                  </span>
                </Button>
              </div>
            </div>

            {filtersOpen ? (
              <div
                className="mt-5 grid gap-4 border-t-2 border-border pt-5 sm:grid-cols-2 lg:grid-cols-3"
                id="opcoes-filtro-biblioteca"
              >
                <label className="text-sm font-extrabold text-muted sm:col-span-2 lg:col-span-1">
                  Buscar
                  <input
                    className={selectClassName}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Atividade ou objetivo"
                    type="search"
                    value={query}
                  />
                </label>

                <FilterSelect
                  label="Tema"
                  onChange={(value) => {
                    setThemeId(value);
                    setSkillId("");
                    setObjectiveId("");
                    setWeekId("");
                    setLessonId("");
                  }}
                  options={themeOptions}
                  value={themeId}
                />
                <FilterSelect
                  label="Habilidade"
                  onChange={(value) => {
                    setSkillId(value);
                    setObjectiveId("");
                    setWeekId("");
                    setLessonId("");
                  }}
                  options={skillOptions}
                  value={skillId}
                />
                <FilterSelect
                  label="Objetivo"
                  onChange={(value) => {
                    setObjectiveId(value);
                    setWeekId("");
                    setLessonId("");
                  }}
                  options={objectiveOptions}
                  value={objectiveId}
                />
                <FilterSelect
                  label="Semana"
                  onChange={(value) => {
                    setWeekId(value);
                    setLessonId("");
                  }}
                  options={weekOptions}
                  value={weekId}
                />
                <FilterSelect
                  label="Aula"
                  onChange={setLessonId}
                  options={lessonOptions}
                  value={lessonId}
                />
                <label className="text-sm font-extrabold text-muted">
                  Situação
                  <select
                    className={selectClassName}
                    onChange={(event) => setStatus(event.target.value as BatchStatusFilter)}
                    value={status}
                  >
                    <option value="all">Todas</option>
                    <option value="completed">Lote concluído</option>
                    <option value="in_progress">Revisão em andamento</option>
                  </select>
                </label>
              </div>
            ) : null}
          </Card>

          <p className="mt-6 font-extrabold text-muted" role="status">
            {filteredActivityCount}{" "}
            {filteredActivityCount === 1 ? "atividade" : "atividades"} em {filteredBatches.length}{" "}
            {filteredBatches.length === 1 ? "lote" : "lotes"}
            {hasActiveFilters ? ` · ${reviewedActivityCount} no total` : ""}
          </p>

          {filteredBatches.length > 0 ? (
            <div className="mt-5 space-y-8">
              {filteredBatches.map((batch) => (
                <ReviewedBatchCard
                  batch={batch}
                  key={batch.batchId}
                  onDelete={() => openDeleteModal(batch)}
                />
              ))}
            </div>
          ) : (
            <Card className="mt-5" padding="lg" raised={false} tone="outlined">
              <h2 className="text-xl font-black">Nenhum resultado para estes filtros</h2>
              <p className="mt-2 font-medium text-muted">
                Ajuste a busca ou limpe os filtros para ver toda a biblioteca.
              </p>
              <Button className="mt-5" onClick={clearFilters} size="sm" variant="secondary">
                Ver toda a biblioteca
              </Button>
            </Card>
          )}
        </>
      ) : (
        <Card className="mt-8" padding="lg" raised={false} tone="outlined">
          <h2 className="text-2xl font-black">Nenhuma atividade revisada ainda</h2>
          <p className="mt-3 font-medium leading-7 text-muted">
            Assim que você aprovar uma atividade, ela aparecerá nesta página e continuará salva.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Link
              className="inline-flex min-h-touch items-center rounded-md font-extrabold text-brand-strong underline decoration-2 underline-offset-4 focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-focus"
              href={pendingBatch ? `/revisar?lote=${encodeURIComponent(pendingBatch.batchId)}` : "/planejar"}
            >
              {pendingBatch ? "Continuar revisão" : "Selecionar uma aula"}
            </Link>
            {pendingBatch ? (
              <Button
                aria-label="Deletar lote em andamento"
                className="size-touch !px-0"
                onClick={() => openDeleteModal(pendingBatch)}
                size="sm"
                title="Deletar lote"
                variant="danger"
              >
                <TrashIcon />
              </Button>
            ) : null}
          </div>
        </Card>
      )}

      {pendingBatch && reviewedActivityCount > 0 ? (
        <Card className="mt-8" padding="md" raised={false} tone="soft">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-black">Há um lote em andamento</h2>
              <p className="mt-1 text-sm font-medium text-muted">
                As decisões já registradas estão salvas. Você pode continuar de onde parou.
              </p>
            </div>
            <Link
              className="font-extrabold text-brand-strong underline decoration-2 underline-offset-4 focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-focus"
              href={`/revisar?lote=${encodeURIComponent(pendingBatch.batchId)}`}
            >
              Continuar revisão
            </Link>
          </div>
        </Card>
      ) : null}

      <Modal
        description="Esta ação é permanente e remove as atividades, revisões e dados de geração deste lote."
        initialFocusRef={confirmationInputRef}
        onClose={closeDeleteModal}
        open={Boolean(deleteTarget)}
        title="Deletar lote?"
        footer={
          <>
            <Button disabled={deletePending} onClick={closeDeleteModal} variant="secondary">
              Cancelar
            </Button>
            <Button
              aria-label={deletePending ? "Deletando lote…" : "Deletar lote"}
              className="size-touch !px-0"
              disabled={deleteConfirmation !== DELETE_CONFIRMATION || deletePending}
              onClick={confirmDelete}
              title="Deletar lote"
              variant="danger"
            >
              <TrashIcon />
            </Button>
          </>
        }
      >
        {deleteTarget ? (
          <>
            <div className="rounded-md bg-danger-soft p-4 text-danger-deep">
              <p className="text-sm font-extrabold">
                {deleteTarget.week.title} · Aula {deleteTarget.lesson.number}
              </p>
              <p className="mt-1 font-black">{deleteTarget.lesson.specificObjective}</p>
              <p className="mt-2 text-sm font-bold">
                {deleteTarget.totalActivities}{" "}
                {deleteTarget.totalActivities === 1 ? "atividade será removida" : "atividades serão removidas"}.
              </p>
            </div>

            <label className="mt-5 block text-sm font-extrabold text-ink">
              Para confirmar, digite <span className="font-black">deletar</span>
              <input
                autoComplete="off"
                className={selectClassName}
                disabled={deletePending}
                onChange={(event) => {
                  setDeleteConfirmation(event.target.value);
                  setDeleteError("");
                }}
                ref={confirmationInputRef}
                spellCheck={false}
                value={deleteConfirmation}
              />
            </label>

            {deleteError ? (
              <p className="mt-4 rounded-md bg-danger-soft p-3 text-sm font-bold text-danger" role="alert">
                {deleteError}
              </p>
            ) : null}
          </>
        ) : null}
      </Modal>
    </>
  );
}

function TrashIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-5"
      fill="none"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function FilterSelect({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  options: FilterOption[];
  value: string;
}) {
  return (
    <label className="text-sm font-extrabold text-muted">
      {label}
      <select
        className={selectClassName}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        <option value="">Todos</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ReviewedBatchCard({
  batch,
  onDelete,
}: {
  batch: ReviewedActivityLibraryBatch;
  onDelete: () => void;
}) {
  return (
    <Card padding="none">
      <section aria-labelledby={`lote-${batch.batchId}`}>
        <div className="border-b-2 border-border bg-neutral-soft p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-extrabold text-muted">
                {batch.theme.name} · {batch.skill.name}
              </p>
              <p className="mt-1 text-sm font-bold text-muted">
                {batch.objective.name} · {batch.week.title} · Aula {batch.lesson.number}
              </p>
              <h2 className="mt-2 text-xl font-black" id={`lote-${batch.batchId}`}>
                {batch.lesson.specificObjective}
              </h2>
              <p className="mt-2 text-sm font-medium text-muted">
                Gerado em{" "}
                <time dateTime={batch.createdAt}>
                  {dateFormatter.format(new Date(batch.createdAt))}
                </time>
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Badge tone={batch.completed ? "success" : "warning"}>
                {batch.completed ? "Lote concluído" : "Revisão em andamento"}
              </Badge>
              <Button
                aria-label={`Deletar lote da aula ${batch.lesson.number}: ${batch.lesson.specificObjective}`}
                className="size-touch !px-0"
                onClick={onDelete}
                size="sm"
                title="Deletar lote"
                variant="danger"
              >
                <TrashIcon />
              </Button>
            </div>
          </div>
        </div>

        <ol className="divide-y-2 divide-border">
          {batch.reviewedActivities.map(({ activity, decision }, index) => (
            <ReviewedActivityItem
              activity={activity}
              batchId={batch.batchId}
              decision={decision}
              isLast={index === batch.reviewedActivities.length - 1}
              key={activity.id}
            />
          ))}
        </ol>
      </section>
    </Card>
  );
}

function ReviewedActivityItem({
  activity,
  batchId,
  decision,
  isLast,
}: ReviewedActivityLibraryBatch["reviewedActivities"][number] & {
  batchId: string;
  isLast: boolean;
}) {
  const approved = decision.decision === "approved";
  const [expanded, setExpanded] = useState(!approved);
  const contentId = `conteudo-atividade-revisada-${activity.id}`;

  return (
    <li className="p-5 sm:p-7">
      <article aria-labelledby={`atividade-revisada-${activity.id}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-extrabold uppercase tracking-[0.08em] text-muted">
            Atividade {activity.slotIndex + 1}
          </p>
          <div className="flex items-center gap-2">
            <span className="text-sm font-extrabold text-muted">
              {activity.durationMinutes} min
            </span>
            <Badge tone={approved ? "success" : "danger"}>
              {approved ? "Aprovada" : "Rejeitada"}
            </Badge>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
          <h3
            className="min-w-0 flex-1 text-2xl font-black tracking-[-0.02em]"
            id={`atividade-revisada-${activity.id}`}
          >
            {activity.title}
          </h3>
          {approved ? (
            <Button
              aria-controls={contentId}
              aria-expanded={expanded}
              onClick={() => setExpanded((open) => !open)}
              size="sm"
              variant="secondary"
            >
              {expanded ? "Ocultar atividade completa" : "Ver atividade completa"}
              <span
                aria-hidden="true"
                className={`text-base transition-transform ${expanded ? "rotate-180" : ""}`}
              >
                ↓
              </span>
            </Button>
          ) : null}
        </div>
        <div hidden={!expanded} id={contentId}>
          <ActivityDescription description={activity.description} />
          {decision.feedback ? (
            <div className="mt-5 rounded-md bg-neutral-soft p-4">
              <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-muted">
                Feedback da revisão
              </p>
              <p className="mt-2 font-medium leading-7 text-muted">
                {decision.feedback}
              </p>
            </div>
          ) : null}
        </div>
        {isLast ? (
          <Link
            className="mt-5 inline-flex min-h-touch items-center rounded-md font-extrabold text-brand-strong underline decoration-2 underline-offset-4 focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-focus"
            href={`/revisar?lote=${encodeURIComponent(batchId)}`}
          >
            Abrir resumo do lote
          </Link>
        ) : null}
      </article>
    </li>
  );
}
