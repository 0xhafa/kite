# Contexto geral do projeto

O projeto Fonemas pretende apoiar a criação de atividades de consciência fonológica e alfabetização pelo método fônico para crianças de aproximadamente 4 anos.

“Fonemas” é o único tema habilitado na primeira POC, mas não deve ser codificado
como uma suposição permanente do domínio. Temas são opções configuradas e cada um
possui sua própria matriz de habilidades, objetivos, semanas e aulas. Um novo tema
pode ser adicionado futuramente sem modificar o currículo de Fonemas.

A matriz curricular já define habilidades, objetivos, semanas, aulas, objetivos específicos e conteúdos. O aplicativo não inventa nem altera essa estrutura. Sua função é transformar um ponto concreto da matriz em um grupo de atividades pedagógicas, revisar automaticamente o resultado e facilitar a validação humana.

## Problema observado

Conversas longas com IAs produziram perda de contexto, repetição de erros já corrigidos, atividades diferentes apenas no nome e inconsistências entre objetivo, método, faixa etária, palavras, materiais e formato editorial.

## Solução pretendida

Separar explicitamente:

- currículo: o que ensinar e quando;
- regras: como gerar e escrever;
- evidências: de onde as regras foram derivadas;
- geração: criação estruturada das atividades;
- validação: prova de atendimento das regras;
- revisão humana: aprovação, rejeição e feedback;
- estado: histórico, versões e consumo de tokens.

## Usuário inicial

Educadora responsável pela produção e revisão do material. A POC pode ser single-user e não necessita autenticação.
