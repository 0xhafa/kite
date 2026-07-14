# Catálogo inicial de regras

`required` bloqueia aprovação automática. `recommended` pode gerar alerta. `editorial` representa padrão da coleção.

| ID | Regra resumida | Tipo de origem | Severidade padrão | Aplicabilidade principal |
|---|---|---|---|---|
| CUR-001 | Preservar objetivo e conteúdo curriculares. | decisão do produto | required | sempre |
| PED-001 | Fazer a criança praticar a habilidade prioritária. | inferência pedagógica | required | sempre |
| PED-002 | Explorar o som antes da letra. | evidência preliminar | required | introdução e relação som–letra |
| PED-003 | Distinguir percepção, produção, síntese e manipulação. | evidência + modelagem do domínio | required | sempre |
| PED-004 | Respeitar a progressão entre aulas. | evidência preliminar | required | sempre |
| PED-005 | Usar modelagem articulatória simples ao introduzir fonema, quando aplicável. | evidência preliminar | recommended | novo fonema |
| AGE-001 | Usar falas concretas e naturais para crianças de 4 anos. | inferência pedagógica | required | sempre |
| AGE-002 | Não exigir explicação articulatória técnica da criança. | inferência pedagógica | required | produção de fonema |
| AGE-003 | Controlar memória de trabalho, espera e quantidade de elementos. | inferência pedagógica | required | sempre |
| LEX-001 | Usar palavras familiares e concretas. | evidência preliminar | required | atividades com palavras |
| LEX-002 | Usar imagens com nomeação previsível. | evidência preliminar | required | atividades com imagens |
| LEX-003 | Na síntese completa, respeitar o repertório de fonemas já trabalhados. | regra metodológica do projeto | required | síntese fonêmica completa |
| LEX-004 | Permitir outros fonemas após o início quando apenas som ou sílaba inicial é analisado. | regra metodológica do projeto | recommended | análise inicial |
| PLAY-001 | A ludicidade deve estar na ação, interação ou desafio. | evidência + inferência | required | sempre |
| PLAY-002 | Evitar narrativas artificiais e antropomorfização de letras. | decisão editorial | editorial | sempre |
| PLAY-003 | Um jogo deve possuir regra e dinâmica reais. | decisão pedagógica | required | atividade chamada jogo |
| PLAY-004 | Todo material deve ter função pedagógica. | inferência pedagógica | required | sempre |
| VAR-001 | Variar a ação da criança, não apenas o cenário. | decisão editorial | required | lote com mais de uma atividade |
| VAR-002 | Evitar adaptação superficial de modelos aprovados. | decisão editorial | required | geração com referências |
| OPS-001 | O passo a passo deve ser autoexecutável. | decisão editorial | required | sempre |
| OPS-002 | Especificar recursos essenciais concretamente. | decisão editorial | required | sempre |
| OPS-003 | O professor conduz a sistematização conceitual final. | decisão pedagógica | recommended | fechamento |
| OPS-004 | Preservar o caráter lúdico de cantigas e parlendas usadas. | evidência + decisão editorial | required | texto oral/cantiga |
| TIME-001 | Respeitar duração total e individual. | requisito do produto | required | sempre |
| EDIT-001 | Aplicar o template editorial configurado para a aula. | decisão editorial | required | quando houver template |
| EDIT-002 | Usar linguagem técnica usual nas orientações ao professor. | decisão editorial | required | sempre |
| GOV-001 | Não promover feedback para regra global sem aprovação. | governança do produto | required | feedback |
| VAL-001 | Não marcar regra como atendida sem evidência. | governança do produto | required | validação |

## Estrutura a implementar

Cada regra deverá possuir:

- texto completo;
- categoria;
- versão;
- severidade;
- condições de aplicabilidade;
- instrução para geração;
- rubrica de validação;
- afirmações e fontes relacionadas;
- exemplos positivos e negativos;
- status ativo ou arquivado.
