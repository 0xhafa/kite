import Image from "next/image";
import Link from "next/link";

import { brandAssets } from "@/lib/brand";

const principles = [
  {
    title: "Currículo preservado",
    description: "A IA apoia o planejamento sem alterar o que deve ser ensinado.",
    color: "bg-[#dff7ef]",
  },
  {
    title: "Validação visível",
    description: "Cada atividade chega acompanhada de evidências e critérios claros.",
    color: "bg-[#fff3c8]",
  },
  {
    title: "Revisão humana",
    description: "Você aprova, rejeita ou gera uma nova versão de cada proposta.",
    color: "bg-[#ffe4df]",
  },
] as const;

export default function Home() {
  return (
    <div className="min-h-screen bg-[#fffdf8] text-[#28334a]">
      <a
        className="sr-only rounded-lg bg-white px-4 py-3 font-bold focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50"
        href="#conteudo"
      >
        Ir para o conteúdo
      </a>

      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5 lg:px-8">
        <a aria-label="Kite — página inicial" href="#conteudo">
          <Image
            alt="Kite"
            height={52}
            priority
            src={brandAssets.principal}
            width={156}
          />
        </a>
        <span className="rounded-full border-2 border-[#dfe5ef] bg-white px-4 py-2 text-xs font-extrabold uppercase tracking-[0.12em] text-[#526078]">
          POC educacional
        </span>
      </header>

      <main id="conteudo">
        <section className="mx-auto grid w-full max-w-6xl items-center gap-12 px-6 pb-20 pt-10 lg:grid-cols-[1.1fr_0.9fr] lg:px-8 lg:pb-28 lg:pt-16">
          <div>
            <p className="mb-5 text-sm font-extrabold uppercase tracking-[0.16em] text-[#2da98b]">
              Planejamento pedagógico assistido
            </p>
            <h1 className="max-w-3xl text-5xl font-black leading-[1.02] tracking-[-0.045em] text-[#28334a] sm:text-6xl">
              Atividades claras, leves e prontas para revisar.
            </h1>
            <p className="mt-6 max-w-2xl text-lg font-medium leading-8 text-[#5e6a80]">
              O Kite transforma objetivos curriculares em propostas rastreáveis, preservando a
              decisão pedagógica em cada etapa.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <Link
                className="rounded-2xl border-2 border-[#202a3f] bg-[#28334a] px-6 py-3.5 font-extrabold text-white shadow-[0_4px_0_#151c2b] transition-transform hover:-translate-y-0.5 focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-[#65a9df]"
                href="/planejar"
              >
                Começar planejamento
              </Link>
              <a
                className="rounded-2xl px-4 py-3.5 font-extrabold text-[#526078] underline decoration-2 underline-offset-4 focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-[#65a9df]"
                href="#como-funciona"
              >
                Conhecer o fluxo
              </a>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-sm" aria-label="Apresentação da marca Kite">
            <div className="absolute -left-5 top-12 h-16 w-16 rounded-[1.75rem] bg-[#dff7ef]" />
            <div className="absolute -right-4 bottom-16 h-20 w-20 rounded-full bg-[#fff3c8]" />
            <div className="relative rounded-[2.5rem] border-2 border-[#e3e7ee] bg-white p-8 shadow-[0_10px_0_#e9edf3]">
              <Image
                alt="Logo vertical colorida do Kite"
                className="mx-auto h-auto w-full max-w-[250px]"
                height={350}
                src={brandAssets.vertical}
                width={320}
              />
              <p className="mt-2 text-center text-sm font-bold leading-6 text-[#647188]">
                Uma identidade amigável para manter o trabalho pedagógico em movimento.
              </p>
            </div>
          </div>
        </section>

        <section className="bg-white py-20" id="como-funciona" aria-labelledby="principios">
          <div className="mx-auto w-full max-w-6xl px-6 lg:px-8">
            <p className="text-sm font-extrabold uppercase tracking-[0.16em] text-[#f0625b]">
              Base do produto
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-[-0.03em] sm:text-4xl" id="principios">
              Apoio inteligente, controle sempre humano.
            </h2>
            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {principles.map((principle, index) => (
                <article
                  className="rounded-3xl border-2 border-[#e4e8ef] p-6 shadow-[0_5px_0_#eef1f5]"
                  key={principle.title}
                >
                  <span
                    aria-hidden="true"
                    className={`flex h-11 w-11 items-center justify-center rounded-2xl text-lg font-black ${principle.color}`}
                  >
                    {index + 1}
                  </span>
                  <h3 className="mt-5 text-xl font-black">{principle.title}</h3>
                  <p className="mt-3 font-medium leading-7 text-[#68758b]">{principle.description}</p>
                </article>
              ))}
            </div>

            <div
              className="mt-8 flex flex-col gap-2 rounded-3xl border-2 border-dashed border-[#ced6e2] bg-[#f7f9fc] px-6 py-5 sm:flex-row sm:items-center sm:justify-between"
              role="status"
            >
              <div>
                <p className="font-black">Nenhum lote gerado ainda</p>
                <p className="mt-1 text-sm font-medium text-[#69768c]">
                  Comece selecionando uma aula do currículo de Fonemas.
                </p>
              </div>
              <Link
                className="text-sm font-extrabold text-[#187b68] underline decoration-2 underline-offset-4 focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#176fa6]"
                href="/planejar"
              >
                Selecionar aula
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
