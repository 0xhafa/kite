# Identidade visual conceitual do Kite

## Status

Conceito provisório v0.2, incorporado ao bootstrap para orientar a interface. Não representa
aprovação final da marca.

## Direção

A identidade parte da pipa apresentada na referência inicial e adota uma execução própria:

- geometria simples e intencionalmente assimétrica;
- painéis planos, levemente desencontrados e sobrepostos, para comunicar uma POC ainda em
  construção sem parecer um erro de renderização;
- cantos e traços arredondados para transmitir proximidade;
- paleta alegre, equilibrada pelo azul-escuro usado em texto e contornos;
- linguagem amigável inspirada em produtos educacionais, sem copiar personagens, ícones ou
  elementos distintivos de outras marcas.

## Variações entregues

| Variação | Arquivo | Uso recomendado |
| --- | --- | --- |
| Principal horizontal | `public/brand/kite-logo-horizontal.svg` | cabeçalho, navegação e documentos largos |
| Vertical | `public/brand/kite-logo-stacked.svg` | abertura, apresentação e telas de boas-vindas |
| Símbolo | `public/brand/kite-symbol.svg` | favicon, avatar e espaços compactos |
| Monocromática | `public/brand/kite-logo-monochrome.svg` | impressão, documentos e contextos sem cor |

## Paleta do conceito

| Papel | Cor |
| --- | --- |
| Azul-escuro / texto | `#28334A` |
| Verde-menta | `#58CCB0` |
| Amarelo | `#FFC84A` |
| Coral | `#FF746B` |
| Azul-claro | `#65A9DF` |
| Fundo quente | `#FFFDF8` |

## Regras provisórias de uso

- preservar a proporção, a ordem de sobreposição e a assimetria dos painéis da pipa;
- manter uma área livre mínima equivalente à largura do ponto da letra `i`;
- usar a versão horizontal com pelo menos 120 px de largura em telas;
- usar o símbolo isolado abaixo desse limite, com pelo menos 24 px;
- priorizar fundo branco ou `#FFFDF8`; em fundos complexos, usar um contêiner claro;
- não aplicar sombras, novos gradientes, contornos extras ou recoloração parcial;
- textos alternativos devem descrever “Kite”; imagens decorativas devem ter texto alternativo vazio.

## Plano de evolução

1. **Bootstrap:** aplicar os SVGs na página inicial e no favicon, mantendo a identidade como conceito.
2. **Validação visual:** testar legibilidade em 16, 24, 32 e 120 px, impressão monocromática e
   contraste sobre os fundos reais da interface.
3. **Refino:** revisar construção, espaçamento e desenho do nome com o time do produto, sem mudar
   a proposta curricular ou os fluxos da POC.
4. **Entrega final:** após aprovação, versionar os arquivos definitivos e exportar PNGs somente
   para canais que não aceitem SVG.

## Critérios para aprovação futura

- reconhecimento do símbolo sem o nome;
- leitura correta de “Kite” em tamanhos de navegação;
- contraste adequado em todas as superfícies aprovadas;
- aparência própria, sem associação indevida com identidades de terceiros;
- funcionamento equivalente nas versões colorida e monocromática.
