## Context

Ver `proposal.md — Why`.

Duas restrições moldaram o desenho:

1. **`clientScope()` já existia em `lib/dal.ts` e ninguém a chamava.** As cinco
   páginas resolviam o cliente na mão, repetindo três linhas. A função certa
   estava escrita e morta; o trabalho foi fazer as páginas usarem-na.
2. **`client_id` aparece em 194 lugares e é a única trava entre clientes.**
   Qualquer desenho que a tocasse trocaria uma simplificação de tela por risco
   numa fronteira de segurança.

Nenhuma dependência nova. O projeto segue com as mesmas 7 de runtime.

## Goals / Non-Goals

**Goals:**

- Um único ponto no código responde "qual cliente?", e ele não pode dizer "nenhum".
- Errar a configuração falha alto e cedo, com mensagem que nomeia a causa.
- A regra continua testável sem banco, como `lib/scope.ts` já era.

**Non-Goals:**

- Multi-instância orquestrada. Subir a segunda instância é trabalho de operação
  (outro `.env`, outro banco), não de código.
- Trocar `TENANT_SLUG` sem reiniciar. Ele é propriedade do deploy.

## Decisions

### 1. O tenant vem do ambiente, não do banco

**Escolhido:** `TENANT_SLUG` obrigatório, resolvido contra `client.slug`.

**Alternativa descartada:** "a única linha não arquivada de `client`". É
sedutora porque dispensa configuração — e é exatamente por isso que é perigosa.
Uma linha de seed esquecida, ou um `archived_at` preenchido errado, trocaria
silenciosamente quem a instância serve. E nada pareceria quebrado: o painel
renderiza, o funil desenha, os números são de outra pessoa. A instância precisa
**declarar** quem é.

**Alternativa descartada:** derivar do domínio da requisição
(`bianca.plataforma.com` → `bianca`). Ata o modelo de dados ao DNS e transforma
um erro de proxy reverso em vazamento entre clientes.

### 2. `clientScope()` devolve `number`, não `number | null`

O tipo é a garantia. Enquanto pudesse devolver `null`, cada chamador precisava
de um ramo "e se não houver cliente?" — e foram cinco ramos, todos renderizando
um seletor. Com o tipo fechado, o ramo deixa de existir e não há como esquecê-lo
numa página nova.

`requireClientScope()` some junto: existia só para converter o `null` em erro.

### 3. A ordem de precedência é preservada, e é uma regra de segurança

```
identity.clientId ?? await tenantId()
```

O `client_id` da usuária vem **primeiro**. Isso já era assim quando a fonte
alternativa era o `?cliente=` da URL, e a razão continua idêntica: nada que a
requisição carregue pode ampliar o escopo de quem já está vinculada. Hoje a
fonte alternativa é confiável (o ambiente), mas inverter a ordem por isso
deixaria a regra dependendo de uma propriedade da configuração em vez de estar
escrita no código.

### 4. `canReach` fica intocado — deliberado

Num banco de uma cliente só, "o consultor alcança qualquer cliente" e "alcança a
cliente da instância" descrevem o mesmo conjunto. O predicado continua correto,
continua puro, continua testado sozinho em `test/scope.test.ts`.

Reescrevê-lo para comparar contra o tenant exigiria acesso ao banco dentro de um
módulo que hoje é uma comparação de dois números — e trocaria a garantia mais
forte que essa fronteira tem (um teste que roda sem infraestrutura) por
consistência estética com o novo modelo.

**Quando reconsiderar:** se um dia duas clientes dividirem o mesmo banco. Aí a
divergência entre "qualquer" e "a da instância" vira real, e a mudança é própria.

### 5. Parte pura e parte com I/O, separadas

`tenantSlug(env)` é pura e testada em quatro casos. `tenantId()` faz a consulta
e é envolta em `cache()` do React — uma consulta por render, não uma por
componente. Mesmo par que `lib/scope.ts` e `lib/dal.ts` já formavam.

## Risks / Trade-offs

- **`TENANT_SLUG` errado derruba a instância para o consultor** → É o
  comportamento desejado, e a mensagem nomeia a variável, o valor recusado e o
  comando de correção. Verificado no navegador. Nota: a **cliente** continua
  entrando normalmente, porque o escopo dela vem do próprio `client_id` — a
  falha atinge só quem depende do tenant.
- **Uma URL antiga com `?cliente=`** → É ignorada, não rejeitada. A página abre
  normal. Rejeitar geraria erro para um link que alguém pode ter salvo.
- **A cobertura de `lib/tenant.ts` fica em 50%** → A metade não coberta é a
  consulta ao banco, exercitada de ponta a ponta (inclusive o caminho de erro).
  Cobrir com mock afirmaria que o mock funciona.
- **Reabrir o multi-cliente na tela é trabalho de verdade** → E é assim que deve
  ser. Ficou registrado aqui o que teria de voltar: `clientScope()` com fonte
  alternativa, um seletor, e a decisão 3 revisitada com cuidado.

## Migration Plan

1. `TENANT_SLUG=<slug>` no `.env` de cada ambiente. **Sem isso a aplicação não
   serve requisição autenticada.**
2. Deploy. Sem migração de banco, sem alteração de dados.
3. **Rollback:** reverter o commit. Nenhum dado foi transformado, então voltar é
   só trocar o código; o `.env` pode manter a variável, que passa a ser ignorada.

## Defeito pré-existente encontrado na verificação

> **Corrigido na mudança `sessao-morta-nao-tranca-fora`**, em 06/08/2026. Fica
> aqui o registro de onde apareceu; a decisão e a verificação estão lá.

Não é desta mudança e não foi corrigido aqui.

**Sessão morta com cookie vivo produz laço de redirecionamento.**
`proxy.ts` manda `/entrar` → `/` quando existe cookie; `requireSession()` manda
`/` → `/entrar` quando o cookie não resolve para uma sessão viva. As duas regras
se alimentam e o navegador para em `ERR_TOO_MANY_REDIRECTS`, sem caminho de
volta que não seja limpar cookies à mão.

Disparado por: linha de `session` apagada, banco restaurado de backup, ou
**usuário desativado** — `readSession()` devolve `null` quando `active !== 1`.
Esse último é caminho de produto, não acidente.

Agrava porque o produto não manda e-mail: quem cai nisso não tem recuperação
self-service e depende de saber limpar cookie.

**Correção provável:** `requireSession()` apagar o cookie antes de redirecionar,
para que `proxy.ts` volte a ver uma requisição sem cookie.
