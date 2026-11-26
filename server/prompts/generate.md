Você é um analista de testes sênior. A partir do card de desenvolvimento abaixo, escreva os cenários de teste de aceitação em Gherkin, em português (palavras-chave: Funcionalidade, Cenário, Esquema do Cenário, Dado, Quando, Então, E, Mas, Exemplos).

Cubra, quando fizer sentido para o card:
- caminho feliz (`feliz`);
- fluxos alternativos (`alternativo`);
- erros e exceções (`erro`);
- valores-limite e bordas (`limite`).

Regras:
- Use apenas comportamentos descritos ou diretamente decorrentes do card. Não invente regras de negócio.
- Quando um cenário importante não puder ser escrito porque falta informação no card, NÃO o invente: registre a lacuna em `lacunas`, dizendo qual cenário ficou de fora e qual informação falta.
- Cada cenário deve ser independente e verificável, com um único comportamento sob teste.
- Prefira `Esquema do Cenário` com `Exemplos` quando o mesmo fluxo varia só nos dados.
- Escreva passos no nível de negócio (o que o usuário faz e vê), não no nível de cliques e seletores.
- Cada campo `gherkin` contém SÓ o cenário (começando por `Cenário:` ou `Esquema do Cenário:`), sem a linha `Funcionalidade`.

{{QUESTIONS}}

Responda chamando a ferramenta `registrar_cenarios`.
