# Segurança e privacidade da POC

- A chave do provedor de IA deve existir apenas no servidor.
- A URL autenticada e o token do Turso devem existir apenas no servidor.
- Não enviar dados pessoais de crianças ao modelo.
- O currículo e atividades devem usar exemplos genéricos ou nomes fictícios quando necessário.
- Logs não devem armazenar segredos.
- O uso bruto do provedor pode ser armazenado, mas não respostas internas não necessárias ao produto.
- Falhas do modelo devem ser tratadas como dados não confiáveis.
- Toda saída deve passar por schema antes de persistência ou renderização.
- O modo local pode usar libSQL em arquivo, mas o banco deve ser ignorado pelo Git.
- Preview e publicação na Vercel devem usar Turso remoto; o filesystem da função
  não será tratado como persistente.
- A POC não terá contas nem múltiplos usuários. Quando for necessário restringir
  uma preview, usar preferencialmente a proteção da plataforma.
- Não armazenar PDFs, imagens ou outros binários no banco. Gerar sob demanda e
  avaliar armazenamento de objetos somente mediante necessidade explícita.
- Respostas reutilizadas pelo cache devem ter passado pelo schema e manter vínculo
  com a execução original.
