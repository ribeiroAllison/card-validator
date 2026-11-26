import type { LlmClient } from "./ai.js";

/**
 * IA simulada para demonstrações sem chave de API.
 * Para os cards de samples/cards.json devolve respostas escritas à mão, no mesmo
 * formato da IA real. Para outros cards, usa heurísticas simples sobre o texto.
 * NÃO avalia nada de verdade: serve só para mostrar o fluxo.
 */

type Crit = [id: string, score: 0 | 1 | 2, justification: string];

interface MockEntry {
  evaluation: { criteria: Crit[]; questions: string[]; summary: string };
  scenarios: { funcionalidade: string; cenarios: { titulo: string; tipo: string; gherkin: string }[]; lacunas: string[] };
}

const g = (...lines: string[]) => lines.join("\n");

const SAMPLES: Record<number, MockEntry> = {
  101: {
    evaluation: {
      criteria: [
        ["objetivo", 2, "User story completa: usuário cadastrado, necessidade (nova senha) e valor (acessar sem o suporte)."],
        ["criterios_aceite", 2, "Seis critérios objetivos, com mensagens exatas e comportamento esperado para cada passo."],
        ["regras_negocio", 2, "Expiração de 30 min, uso único, política de senha, histórico das 3 últimas e limite de tentativas explícitos."],
        ["casos_erro", 2, "Cobre link expirado ou já usado, senha fora da política e excesso de solicitações."],
        ["dados_limites", 1, "Limites de senha e tentativas definidos, mas não diz como tratar e-mail com formato inválido."],
        ["dependencias", 2, "Cita o serviço de e-mail transacional e deixa SMS fora do escopo."],
      ],
      questions: [
        "O que acontece se o e-mail digitado tiver formato inválido: validação no campo ou a mesma mensagem genérica?",
        "Ao solicitar um novo link, os links anteriores ainda válidos são invalidados?",
      ],
      summary: "Card pronto para desenvolvimento. Só falta definir o tratamento de e-mail com formato inválido e dos links anteriores.",
    },
    scenarios: {
      funcionalidade: "Recuperação de senha por e-mail",
      cenarios: [
        {
          titulo: "Solicitar link com e-mail cadastrado",
          tipo: "feliz",
          gherkin: g(
            "Cenário: Solicitar link com e-mail cadastrado",
            "  Dado que existe um usuário cadastrado com o e-mail \"ana@empresa.com\"",
            "  E estou na tela de login",
            "  Quando clico em \"Esqueci minha senha\"",
            "  E informo o e-mail \"ana@empresa.com\"",
            "  Então vejo a mensagem \"Se o e-mail estiver cadastrado, você receberá um link em instantes.\"",
            "  E um e-mail com o link de redefinição é enviado para \"ana@empresa.com\" em até 1 minuto",
          ),
        },
        {
          titulo: "Solicitar link com e-mail não cadastrado",
          tipo: "alternativo",
          gherkin: g(
            "Cenário: Solicitar link com e-mail não cadastrado",
            "  Dado que não existe usuário com o e-mail \"nao.existe@empresa.com\"",
            "  Quando solicito a recuperação de senha para \"nao.existe@empresa.com\"",
            "  Então vejo a mensagem \"Se o e-mail estiver cadastrado, você receberá um link em instantes.\"",
            "  E nenhum e-mail é enviado",
          ),
        },
        {
          titulo: "Redefinir senha com link válido",
          tipo: "feliz",
          gherkin: g(
            "Cenário: Redefinir senha com link válido",
            "  Dado que recebi um link de redefinição há 10 minutos",
            "  E tenho uma sessão ativa em outro dispositivo",
            "  Quando abro o link",
            "  E informo e confirmo a nova senha \"NovaSenha2026\"",
            "  Então sou redirecionado para o login com a mensagem \"Senha alterada com sucesso\"",
            "  E a sessão do outro dispositivo é encerrada",
          ),
        },
        {
          titulo: "Link expirado",
          tipo: "erro",
          gherkin: g(
            "Cenário: Abrir link expirado",
            "  Dado que recebi um link de redefinição há 31 minutos",
            "  Quando abro o link",
            "  Então vejo a mensagem \"Este link não é mais válido\"",
            "  E vejo um botão para solicitar um novo link",
          ),
        },
        {
          titulo: "Link já utilizado",
          tipo: "erro",
          gherkin: g(
            "Cenário: Abrir link já utilizado",
            "  Dado que já redefini minha senha usando um link",
            "  Quando abro o mesmo link novamente",
            "  Então vejo a mensagem \"Este link não é mais válido\"",
          ),
        },
        {
          titulo: "Senha fora da política",
          tipo: "erro",
          gherkin: g(
            "Esquema do Cenário: Senha fora da política",
            "  Dado que abri um link de redefinição válido",
            "  Quando informo a nova senha \"<senha>\"",
            "  Então vejo abaixo do campo a regra \"<regra>\"",
            "  E a senha não é alterada",
            "",
            "  Exemplos:",
            "    | senha    | regra                                |",
            "    | Abc1234  | mínimo de 8 caracteres               |",
            "    | abcdefg1 | ao menos uma letra maiúscula         |",
            "    | ABCDEFG1 | ao menos uma letra minúscula         |",
            "    | Abcdefgh | ao menos um número                   |",
          ),
        },
        {
          titulo: "Tamanho da senha nos limites",
          tipo: "limite",
          gherkin: g(
            "Esquema do Cenário: Tamanho da senha nos limites da política",
            "  Dado que abri um link de redefinição válido",
            "  Quando informo uma senha válida com <tamanho> caracteres",
            "  Então o resultado é \"<resultado>\"",
            "",
            "  Exemplos:",
            "    | tamanho | resultado         |",
            "    | 8       | senha alterada    |",
            "    | 64      | senha alterada    |",
            "    | 65      | senha recusada    |",
          ),
        },
        {
          titulo: "Senha igual a uma das 3 últimas",
          tipo: "erro",
          gherkin: g(
            "Cenário: Reutilizar uma das 3 últimas senhas",
            "  Dado que minhas 3 últimas senhas foram \"Senha2024a\", \"Senha2025a\" e \"Senha2026a\"",
            "  E abri um link de redefinição válido",
            "  Quando informo a nova senha \"Senha2025a\"",
            "  Então a senha não é alterada",
            "  E sou informado de que não posso repetir as últimas senhas",
          ),
        },
        {
          titulo: "Excesso de solicitações",
          tipo: "limite",
          gherkin: g(
            "Cenário: Quarta solicitação em menos de 15 minutos",
            "  Dado que solicitei o link 3 vezes para \"ana@empresa.com\" nos últimos 15 minutos",
            "  Quando solicito o link pela quarta vez",
            "  Então vejo a mensagem \"Muitas tentativas. Tente novamente em alguns minutos.\"",
            "  E nenhum e-mail é enviado",
          ),
        },
      ],
      lacunas: [
        "E-mail com formato inválido: o card não diz se há validação no campo ou se vale a mensagem genérica.",
        "Novo link com outro ainda válido: não está definido se o link anterior é invalidado.",
      ],
    },
  },

  102: {
    evaluation: {
      criteria: [
        ["objetivo", 2, "Usuário (gerente comercial), necessidade e valor estão claros."],
        ["criterios_aceite", 1, "Há critérios, mas 'a exportação deve ser rápida' não é verificável e não diz o formato do arquivo (.xlsx ou .csv)."],
        ["regras_negocio", 1, "Diz que respeita os filtros, mas não define ordenação, formato de datas e valores, nem o nome do arquivo."],
        ["casos_erro", 0, "Nada sobre filtro sem resultados, falha na geração ou falta de permissão."],
        ["dados_limites", 1, "Colunas listadas, mas sem volume máximo de linhas nem formato de cada coluna."],
        ["dependencias", 0, "Não cita permissões, biblioteca de geração nem o que fica fora do escopo (ex.: gráficos)."],
      ],
      questions: [
        "Qual o tempo máximo aceitável para a exportação, e para quantas linhas?",
        "O que deve acontecer quando o filtro não retorna nenhuma venda?",
        "O arquivo é .xlsx ou .csv? Qual o padrão do nome do arquivo?",
        "Datas e valores devem sair formatados (dd/mm/aaaa, R$) ou como dado bruto para análise?",
        "Existe limite de linhas? Se o período for muito grande, a exportação é bloqueada, paginada ou enviada por e-mail?",
        "Quais perfis podem exportar? O vendedor vê só as próprias vendas?",
      ],
      summary: "Objetivo claro, mas o card ainda não está pronto: faltam casos de erro, limites de volume e um critério de desempenho mensurável.",
    },
    scenarios: {
      funcionalidade: "Exportar relatório de vendas para Excel",
      cenarios: [
        {
          titulo: "Exportar com filtros aplicados",
          tipo: "feliz",
          gherkin: g(
            "Cenário: Exportar vendas respeitando os filtros",
            "  Dado que estou na tela de relatório de vendas",
            "  E filtrei o período de 01/10/2026 a 31/10/2026, o vendedor \"Carlos\" e a região \"Sul\"",
            "  Quando clico em \"Exportar Excel\"",
            "  Então um arquivo é baixado",
            "  E ele contém apenas as vendas que atendem aos três filtros",
          ),
        },
        {
          titulo: "Colunas do arquivo",
          tipo: "feliz",
          gherkin: g(
            "Cenário: Arquivo exportado contém as colunas definidas",
            "  Dado que exportei o relatório de vendas",
            "  Quando abro o arquivo",
            "  Então vejo as colunas data, número do pedido, cliente, vendedor, região e valor total, nessa ordem",
          ),
        },
        {
          titulo: "Exportar sem filtros",
          tipo: "alternativo",
          gherkin: g(
            "Cenário: Exportar sem nenhum filtro aplicado",
            "  Dado que estou na tela de relatório de vendas sem filtros",
            "  Quando clico em \"Exportar Excel\"",
            "  Então o arquivo contém as mesmas vendas exibidas na tela",
          ),
        },
      ],
      lacunas: [
        "Filtro sem resultados: o card não diz se o arquivo sai vazio, se aparece uma mensagem ou se o botão fica desabilitado.",
        "Desempenho: 'deve ser rápida' não tem tempo nem volume definidos, então não há como escrever o cenário.",
        "Grande volume: sem limite de linhas, não dá para testar o comportamento com períodos longos.",
        "Permissões: não está definido quem pode exportar nem se o vendedor vê só as próprias vendas.",
      ],
    },
  },

  103: {
    evaluation: {
      criteria: [
        ["objetivo", 1, "Diz o que mexer (tela de cadastro de clientes), mas não quem usa nem qual problema resolve."],
        ["criterios_aceite", 0, "Sem critérios de aceite."],
        ["regras_negocio", 0, "'Validar os campos' sem dizer quais campos nem quais regras."],
        ["casos_erro", 0, "Nenhum caso de erro mencionado."],
        ["dados_limites", 0, "Campos, formatos e limites não informados."],
        ["dependencias", 0, "Depende de 'conversado com o cliente na reunião', informação que não está no card."],
      ],
      questions: [
        "O que exatamente foi combinado na reunião com o cliente? Há ata ou protótipo para anexar ao card?",
        "Quais campos da tela precisam de validação, e qual a regra de cada um (obrigatório, formato, tamanho)?",
        "O que significa 'mais amigável' neste caso: layout, ordem dos campos, máscaras, mensagens?",
        "Como o usuário deve ser avisado de um campo inválido: ao sair do campo ou ao salvar?",
        "O CPF/CNPJ precisa ser validado pelo dígito verificador? E-mail e telefone também?",
        "Há algum cadastro duplicado a ser impedido (mesmo CPF/CNPJ)?",
        "O que fica fora do escopo desta entrega?",
      ],
      summary: "Card não está pronto: não tem critérios de aceite e depende de uma conversa que não foi registrada. Precisa voltar para o refinamento.",
    },
    scenarios: {
      funcionalidade: "Cadastro de clientes",
      cenarios: [
        {
          titulo: "Salvar cliente com campos válidos",
          tipo: "feliz",
          gherkin: g(
            "Cenário: Salvar cliente com todos os campos válidos",
            "  Dado que estou na tela de cadastro de clientes",
            "  Quando preencho todos os campos com dados válidos",
            "  E clico em salvar",
            "  Então o cliente é cadastrado",
          ),
        },
      ],
      lacunas: [
        "Validação de campos: o card não diz quais campos validar nem as regras, então não há como escrever cenários de erro.",
        "'Mais amigável' não é verificável: não há critério para testar a melhoria da tela.",
        "Mensagens de erro, campos obrigatórios e duplicidade de cadastro não estão definidos.",
      ],
    },
  },

  104: {
    evaluation: {
      criteria: [
        ["objetivo", 2, "Usuário (cliente da loja), ação e valor estão claros."],
        ["criterios_aceite", 1, "Critérios cobrem aplicar e remover, mas 'mostrar mensagem de erro' não diz qual mensagem para cada motivo."],
        ["regras_negocio", 1, "Tipos de cupom, limite de um por pedido, validade e valor mínimo estão citados, mas sem detalhes (ex.: desconto sobre frete? arredondamento?)."],
        ["casos_erro", 1, "Fala em cupom inválido de forma genérica, sem separar expirado, inexistente ou abaixo do valor mínimo."],
        ["dados_limites", 1, "Não define formato do código (maiúsculas, tamanho) nem limite máximo de desconto percentual."],
        ["dependencias", 0, "Não diz de onde vêm os cupons (cadastro, integração) nem o que acontece se o carrinho mudar após aplicar."],
      ],
      questions: [
        "Qual mensagem exibir para cada motivo: cupom inexistente, expirado e pedido abaixo do valor mínimo?",
        "O desconto incide sobre o frete?",
        "Se o cliente remover itens e o pedido ficar abaixo do valor mínimo, o cupom é removido automaticamente?",
        "O código do cupom diferencia maiúsculas de minúsculas?",
        "Cupom de valor fixo maior que o total do pedido zera o pedido ou é recusado?",
        "Onde os cupons são cadastrados? Já existe essa funcionalidade?",
      ],
      summary: "Bom ponto de partida, mas abaixo da nota mínima: as regras existem só em tópicos e os casos de erro não têm comportamento definido.",
    },
    scenarios: {
      funcionalidade: "Cupom de desconto no checkout",
      cenarios: [
        {
          titulo: "Aplicar cupom percentual válido",
          tipo: "feliz",
          gherkin: g(
            "Cenário: Aplicar cupom percentual válido",
            "  Dado que tenho um pedido de R$ 200,00 no checkout",
            "  E existe o cupom \"DEZOFF\" de 10% dentro da validade",
            "  Quando aplico o cupom \"DEZOFF\"",
            "  Então vejo o desconto de R$ 20,00",
            "  E o novo total de R$ 180,00",
          ),
        },
        {
          titulo: "Aplicar cupom de valor fixo",
          tipo: "feliz",
          gherkin: g(
            "Cenário: Aplicar cupom de valor fixo válido",
            "  Dado que tenho um pedido de R$ 200,00 no checkout",
            "  E existe o cupom \"MENOS30\" de R$ 30,00 dentro da validade",
            "  Quando aplico o cupom \"MENOS30\"",
            "  Então o novo total é R$ 170,00",
          ),
        },
        {
          titulo: "Apenas um cupom por pedido",
          tipo: "alternativo",
          gherkin: g(
            "Cenário: Tentar aplicar um segundo cupom",
            "  Dado que já apliquei o cupom \"DEZOFF\" no pedido",
            "  Quando tento aplicar o cupom \"MENOS30\"",
            "  Então o pedido continua com apenas um cupom aplicado",
          ),
        },
        {
          titulo: "Remover cupom",
          tipo: "alternativo",
          gherkin: g(
            "Cenário: Remover o cupom aplicado",
            "  Dado que apliquei o cupom \"DEZOFF\" em um pedido de R$ 200,00",
            "  Quando removo o cupom",
            "  Então o total volta a ser R$ 200,00",
          ),
        },
        {
          titulo: "Cupom expirado",
          tipo: "erro",
          gherkin: g(
            "Cenário: Aplicar cupom expirado",
            "  Dado que o cupom \"BLACK25\" expirou ontem",
            "  Quando aplico o cupom \"BLACK25\"",
            "  Então vejo uma mensagem de erro",
            "  E o total do pedido não muda",
          ),
        },
      ],
      lacunas: [
        "Mensagens de erro: o card não diferencia cupom inexistente, expirado e abaixo do valor mínimo, então os cenários só verificam 'uma mensagem de erro'.",
        "Valor mínimo: sem o valor nem o comportamento ao remover itens, não dá para testar o limite.",
        "Frete e cupom maior que o total: comportamento não definido.",
      ],
    },
  },
};

// ---------------------------------------------------------------------------

function fallbackEvaluation(text: string): MockEntry["evaluation"] {
  const t = text.toLowerCase();
  const criteriaSection = t.split("## critérios de aceite")[1] ?? "";
  const hasAc = criteriaSection.replace("(vazio)", "").trim().length > 40;
  const has = (...words: string[]) => words.some((w) => t.includes(w));
  return {
    criteria: [
      ["objetivo", has("como ", "quero", "para ") ? 2 : 1, "Avaliação simulada pelo texto do card."],
      ["criterios_aceite", hasAc ? 1 : 0, hasAc ? "Há critérios de aceite; a IA simulada não avalia se são testáveis." : "Sem critérios de aceite."],
      ["regras_negocio", has("regra", "deve", "não pode", "máximo", "mínimo") ? 1 : 0, "Avaliação simulada pelo texto do card."],
      ["casos_erro", has("erro", "inválid", "falha", "expirad") ? 1 : 0, "Avaliação simulada pelo texto do card."],
      ["dados_limites", /\d/.test(t) ? 1 : 0, "Avaliação simulada pelo texto do card."],
      ["dependencias", has("depend", "integra", "fora do escopo") ? 1 : 0, "Avaliação simulada pelo texto do card."],
    ],
    questions: [
      "Quais são os critérios de aceite objetivos para considerar este card pronto?",
      "O que deve acontecer em caso de erro ou dado inválido?",
      "Quais são os limites e formatos dos dados envolvidos?",
    ],
    summary: "Resultado SIMULADO: configure a ANTHROPIC_API_KEY para uma avaliação real deste card.",
  };
}

function fallbackScenarios(title: string): MockEntry["scenarios"] {
  return {
    funcionalidade: title,
    cenarios: [
      {
        titulo: "Caminho feliz",
        tipo: "feliz",
        gherkin: g(`Cenário: ${title} com dados válidos`, "  Dado que o usuário tem acesso à funcionalidade", "  Quando executa a ação com dados válidos", "  Então o resultado esperado é exibido"),
      },
    ],
    lacunas: ["Resultado SIMULADO: configure a ANTHROPIC_API_KEY para gerar cenários reais deste card."],
  };
}

export function createMockClient(delayMs = 900): LlmClient {
  return {
    model: "simulado",
    async callTool({ tool, user }) {
      await new Promise((r) => setTimeout(r, delayMs));
      const id = Number(/# Card #(\d+)/.exec(user)?.[1]);
      const title = /## Título\n(.+)/.exec(user)?.[1]?.trim() ?? "Funcionalidade";
      const entry = SAMPLES[id];
      if (tool.name === "registrar_avaliacao") {
        const ev = entry?.evaluation ?? fallbackEvaluation(user);
        return {
          criteria: ev.criteria.map(([cid, score, justification]) => ({ id: cid, score, justification })),
          questions: ev.questions,
          summary: ev.summary,
        };
      }
      return structuredClone(entry?.scenarios ?? fallbackScenarios(title));
    },
  };
}
