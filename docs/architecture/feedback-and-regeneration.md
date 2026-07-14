# Feedback e regeneração

## Rejeição

O feedback é opcional. A ausência de feedback não bloqueia regeneração.

## Regeneração pontual

Ao rejeitar uma atividade:

- preservar atividades não rejeitadas;
- preservar posição no lote;
- preservar duração individual;
- reutilizar currículo e regras aplicáveis;
- incluir o feedback apenas no contexto necessário;
- validar a nova atividade contra as preservadas para evitar repetição.

## Escopos de feedback

### Regeneração

Válido apenas para produzir a substituta atual.

### Sessão ou sequência

Aplicável às próximas gerações daquele lote, aula ou objetivo.

### Candidato a regra

A IA normaliza o feedback e propõe uma regra. A pessoa responsável precisa aprová-la, definir escopo, severidade e origem antes de ativá-la.

## Versionamento

A promoção de uma regra cria nova versão do conjunto de regras. Atividades antigas mantêm referência à versão utilizada quando foram geradas.

## Feedback negativo acumulado

Atividades rejeitadas podem ser usadas como exemplos de padrões indesejados, mas o prompt deve receber apenas exemplos relevantes ao contexto atual, não todo o histórico.
