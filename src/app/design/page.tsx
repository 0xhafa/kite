"use client";

import { useState } from "react";

import { Badge, Button, Card, Modal, Progress } from "@/components/ui";
import { designTokens } from "@/design/tokens";

const palette = [
  ["Marca", designTokens.colors.brand],
  ["Destaque", designTokens.colors.accent],
  ["Texto", designTokens.colors.ink],
  ["Superfície", designTokens.colors.surface],
  ["Sucesso", designTokens.colors.success],
  ["Atenção", designTokens.colors.warning],
  ["Perigo", designTokens.colors.danger],
  ["Informação", designTokens.colors.info],
] as const;

export default function DesignSystemPage() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <a
        className="sr-only rounded-md bg-surface px-4 py-3 font-bold focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50"
        href="#conteudo"
      >
        Ir para o conteúdo
      </a>

      <header className="border-b-2 border-border bg-surface">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-6 py-8 sm:px-8">
          <Badge tone="info">Fundação visual</Badge>
          <h1 className="text-title font-black tracking-[-0.03em] sm:text-display">Design do Kite</h1>
          <p className="max-w-2xl text-lead font-medium text-muted">
            Componentes claros e acolhedores para apoiar decisões pedagógicas rastreáveis.
          </p>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-6xl gap-12 px-6 py-12 sm:px-8" id="conteudo">
        <section aria-labelledby="cores">
          <h2 className="text-2xl font-black" id="cores">
            Cores
          </h2>
          <p className="mt-2 font-medium text-muted">Paleta própria com funções semânticas.</p>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {palette.map(([name, value]) => (
              <Card className="overflow-hidden" key={name} padding="none" raised={false}>
                <div className="h-20 border-b-2 border-border" style={{ backgroundColor: value }} />
                <div className="p-4">
                  <p className="font-extrabold">{name}</p>
                  <code className="mt-1 block text-xs text-muted">{value}</code>
                </div>
              </Card>
            ))}
          </div>
        </section>

        <section aria-labelledby="tipografia">
          <h2 className="text-2xl font-black" id="tipografia">
            Tipografia
          </h2>
          <Card className="mt-6 grid gap-6">
            <p className="text-display font-black tracking-[-0.04em]">Título de destaque</p>
            <p className="text-title font-black">Título de seção</p>
            <p className="max-w-3xl text-body font-medium text-muted">
              O texto de leitura usa ritmo confortável e vocabulário direto para comunicar estados,
              evidências e próximas ações.
            </p>
            <p className="text-caption font-extrabold uppercase tracking-[0.12em] text-brand">
              Rótulo de apoio
            </p>
          </Card>
        </section>

        <section aria-labelledby="acoes">
          <h2 className="text-2xl font-black" id="acoes">
            Ações
          </h2>
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <Button>Gerar atividades</Button>
            <Button variant="secondary">Ver detalhes</Button>
            <Button variant="ghost">Voltar</Button>
            <Button variant="danger">Rejeitar</Button>
            <Button disabled>Processando</Button>
          </div>
        </section>

        <section aria-labelledby="estados">
          <h2 className="text-2xl font-black" id="estados">
            Estados e progresso
          </h2>
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <Card>
              <h3 className="text-lg font-black">Revisão do lote</h3>
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge tone="success">Aprovada</Badge>
                <Badge tone="warning">Pendente</Badge>
                <Badge tone="danger">Rejeitada</Badge>
                <Badge tone="info">Em validação</Badge>
                <Badge>Rascunho</Badge>
              </div>
            </Card>
            <Card>
              <Progress label="Atividades revisadas" value={60} />
              <Progress className="mt-6" label="Duração planejada" tone="success" value={20} max={25} />
            </Card>
          </div>
        </section>

        <section aria-labelledby="cartoes">
          <h2 className="text-2xl font-black" id="cartoes">
            Cartões e modal
          </h2>
          <div className="mt-6 grid gap-5 md:grid-cols-3">
            <Card>
              <Badge tone="success">Validada</Badge>
              <h3 className="mt-4 text-xl font-black">Caça ao som inicial</h3>
              <p className="mt-2 font-medium leading-7 text-muted">
                Identificar o fonema inicial em palavras apresentadas oralmente.
              </p>
            </Card>
            <Card tone="soft">
              <h3 className="text-xl font-black">Duração configurável</h3>
              <p className="mt-2 font-medium leading-7 text-muted">
                O grupo começa com 25 minutos e mantém a soma das atividades visível.
              </p>
            </Card>
            <Card className="flex flex-col items-start justify-between gap-6" tone="outlined">
              <div>
                <h3 className="text-xl font-black">Relatório de validação</h3>
                <p className="mt-2 font-medium leading-7 text-muted">
                  Critérios e evidências aparecem em uma camada acessível.
                </p>
              </div>
              <Button onClick={() => setModalOpen(true)} variant="secondary">
                Abrir exemplo
              </Button>
            </Card>
          </div>
        </section>
      </main>

      <Modal
        description="Exemplo do painel usado para apresentar critérios, resultados e evidências."
        footer={
          <>
            <Button onClick={() => setModalOpen(false)} variant="ghost">
              Voltar
            </Button>
            <Button onClick={() => setModalOpen(false)}>Entendi</Button>
          </>
        }
        onClose={() => setModalOpen(false)}
        open={modalOpen}
        title="Relatório de validação"
      >
        <Card raised={false} tone="soft">
          <Badge tone="success">Critério atendido</Badge>
          <p className="mt-3 font-bold">O objetivo curricular foi preservado integralmente.</p>
          <p className="mt-2 text-sm font-medium leading-6 text-muted">
            Evidência: a atividade solicita identificação oral do fonema inicial, conforme o objetivo
            selecionado.
          </p>
        </Card>
      </Modal>
    </div>
  );
}
