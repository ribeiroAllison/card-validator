# Card Validator

Prova de conceito da Peers Solutions: dois agentes de IA ligados ao **Azure DevOps** que atuam no refinamento, antes do desenvolvimento.

1. **Avaliador de cards.** Dá uma nota de 0 a 100 à qualidade do card, segundo uma rubrica, e devolve as perguntas que o time deve fazer ao PO.
2. **Gerador de cenários.** Transforma o card aprovado em cenários de teste em Gherkin (caminho feliz, alternativos, erros e limites) e lista os cenários que ficaram de fora por falta de informação.

O resultado pode ser publicado como comentário no próprio work item. O QA marca cada cenário como *útil*, *editado* ou *descartado*. Esse registro é a base da métrica de cenários aceitos sem edição.

## Como rodar

Pré-requisito: Node.js 20 ou mais recente.

```bash
npm install
cp .env.example .env      # preencha as variáveis
npm run dev               # API em :3001 e front em http://localhost:5173
```

Sem as variáveis `AZDO_*`, o app roda em **modo demo** com os cards de `samples/cards.json`: um bom, um médio, um ruim e um intermediário.

### IA simulada (sem custo)

Sem `ANTHROPIC_API_KEY`, ou com `AI_MOCK=true`, o app usa uma **IA simulada** (`server/src/mock.ts`). Ela devolve respostas prontas, escritas à mão para os 4 cards de exemplo, no mesmo formato da IA real. As notas ficam em 94, 41, 6 e 50. Para outros cards, usa heurísticas simples e avisa que o resultado é simulado. O topo da tela mostra **"IA simulada"** enquanto esse modo estiver ativo.

Serve para demonstrar o fluxo sem gastar créditos. A avaliação real só acontece com a chave configurada.

Para produção local, `npm run build && npm start` serve tudo em `http://localhost:3001`.

### Variáveis (`.env`)

| Variável | Para que serve |
|---|---|
| `AZDO_ORG` | Organização do Azure DevOps (o trecho depois de `dev.azure.com/`) |
| `AZDO_PROJECT` | Projeto de onde os cards são lidos |
| `AZDO_PAT` | Personal Access Token com escopo **Work Items: Read & write**. Prefira validade curta |
| `ANTHROPIC_API_KEY` | Chave da API do Claude |
| `ANTHROPIC_MODEL` | Modelo usado (padrão `claude-sonnet-5-5`) |
| `AI_MOCK` | `true` força a IA simulada mesmo com chave configurada |
| `MIN_SCORE` | Nota mínima para liberar a geração de cenários (padrão 70) |

O `.env` está no `.gitignore`. Nunca faça commit de tokens.

## Como funciona

```
Azure DevOps ──(REST)──► server (Node/Express) ──► Claude (respostas em JSON via tool use)
     ▲                         │
     └──── comentário ◄────────┤
                               ▼
                        web (React/Vite)
```

- **A nota é calculada pelo código, não pela IA.** A IA dá 0, 1 ou 2 por critério, com justificativa. O servidor faz a média ponderada pelos pesos da rubrica. Isso deixa a nota explicável e mais estável entre execuções.
- **Cenários só são liberados com nota mínima.** Abaixo dela, o front oferece "Gerar mesmo assim", e as perguntas em aberto vão junto para a IA não presumir respostas.
- **Leitura dos cards:** título, Description (ou Repro Steps em bugs) e Acceptance Criteria. A lista mostra os 50 cards abertos mais recentes do tipo User Story, PBI, Bug ou Requirement.

## Onde ajustar

| Arquivo | O que muda |
|---|---|
| `server/config/rubric.json` | Critérios, pesos e descrição de cada nível. Versione ao alterar |
| `server/prompts/evaluate.md` | Instruções do avaliador |
| `server/prompts/generate.md` | Instruções do gerador de cenários |
| `samples/cards.json` | Cards do modo demo |

O feedback do QA é gravado em `data/feedback.jsonl`, uma linha por avaliação de cenário.

## API

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/health` | Modo (demo/azdo), modelo e nota mínima |
| GET | `/api/cards` | Lista de cards |
| GET | `/api/cards/:id` | Card completo |
| POST | `/api/cards/:id/evaluate` | Avalia o card |
| POST | `/api/cards/:id/scenarios` | Gera cenários. Body: `{ evaluation?, force? }` |
| POST | `/api/cards/:id/feature` | Baixa o `.feature`. Body: `{ scenarios }` |
| POST | `/api/cards/:id/publish` | Comenta no work item (no modo demo, só devolve a prévia) |
| POST | `/api/feedback` | `{ cardId, scenarioTitle, verdict: util \| editado \| descartado }` |

## Testes

```bash
npm test
```

Os testes cobrem o cálculo da nota, a conversão de HTML e o fluxo completo da API em modo demo, com uma IA falsa.

## Limitações conhecidas (PoC)

- Sem autenticação: rode localmente ou em rede interna.
- O PAT é de uma pessoa. Num piloto maior, o ideal é uma service connection ou Entra ID.
- Use projetos internos da Peers até validar com o jurídico o envio de dados de clientes à IA.
- Os cenários são publicados como comentário. Criar work items do tipo Test Case fica para uma próxima versão.
