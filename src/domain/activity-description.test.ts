import { describe, expect, it } from "vitest";

import {
  formatActivityDescription,
  parseActivityDescription,
} from "./activity-description";

describe("descrição estruturada da atividade", () => {
  it("separa rótulos editoriais mesmo quando vieram no mesmo parágrafo", () => {
    const description =
      "Recursos: quatro imagens. Preparação: organize uma pilha. Apresentação: mostre a primeira imagem. Ações: convide as crianças a nomear. Transição e encerramento: faça uma rodada curta.";

    expect(parseActivityDescription(description)).toEqual([
      { label: "Recursos", text: "quatro imagens." },
      { label: "Preparação", text: "organize uma pilha." },
      { label: "Apresentação", text: "mostre a primeira imagem." },
      { label: "Ações", text: "convide as crianças a nomear." },
      { label: "Transição e encerramento", text: "faça uma rodada curta." },
    ]);
    expect(formatActivityDescription(description)).toContain(
      "Recursos: quatro imagens.\n\nPreparação: organize uma pilha.",
    );
  });

  it("preserva texto livre e omite etapas que não se aplicam", () => {
    expect(parseActivityDescription("Convide a turma a comparar duas palavras.")).toEqual([
      { text: "Convide a turma a comparar duas palavras." },
    ]);
  });

  it("aceita rótulos destacados sem expor a marcação", () => {
    expect(parseActivityDescription("**Recursos:** cartões.\n\n**Ações:** nomear.")).toEqual([
      { label: "Recursos", text: "cartões." },
      { label: "Ações", text: "nomear." },
    ]);
  });
});
