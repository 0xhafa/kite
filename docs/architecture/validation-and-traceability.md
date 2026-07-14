# Validação e rastreabilidade

## Cadeia

```text
Fonte
→ afirmação atômica
→ regra versionada
→ condição de aplicabilidade
→ instrução de geração
→ critério de validação
→ evidência na atividade
→ decisão humana
```

## Status de validação

- `passed`: há evidência suficiente na atividade;
- `failed`: a atividade contradiz ou omite requisito obrigatório aplicável;
- `needs_review`: julgamento humano necessário;
- `not_applicable`: condição da regra não se aplica;
- `not_evaluated`: erro ou ausência de avaliação.

## Proibição

Uma regra não pode receber `passed` sem:

- evidência textual ou estrutural;
- explicação curta;
- versão da regra;
- identificação do avaliador.

## Tipos de origem

### Evidência direta

A regra é uma operacionalização próxima de uma afirmação extraída da fonte.

### Inferência pedagógica

A fonte sustenta um princípio amplo e a equipe tomou uma decisão de implementação.

### Regra editorial

Preferência ou padrão específico da coleção, sem alegação de comprovação acadêmica direta.

## Exibição

O relatório deve mostrar primeiro o resultado resumido. Fonte completa e afirmação aparecem sob demanda, para não sobrecarregar a tela principal.
