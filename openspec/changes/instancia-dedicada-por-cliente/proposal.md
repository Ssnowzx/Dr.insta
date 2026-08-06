## Why

A plataforma nasceu multi-cliente no banco com uma cliente na tela, e o custo
disso não é teórico: o consultor não tem `client_id`, então **toda** página
protegida precisa perguntar "qual cliente?" antes de mostrar qualquer coisa.
A resposta vinha de um seletor e de um `?cliente=` na URL — cinco páginas
repetindo a mesma resolução de três linhas, cada uma com sua própria chance de
errar a ordem entre "o id da usuária" e "o que a URL pediu".

O produto atende uma cliente. Manter a escolha em runtime é pagar complexidade
de agência para operar uma conta só — e é a superfície que precisa estar limpa
antes da integração com a API do Instagram, que vai gravar métrica por post
contra um `client_id` que ninguém deveria poder trocar por query string.

## What Changes

- **BREAKING** `TENANT_SLUG` passa a ser obrigatório. Sem ele a aplicação recusa
  a primeira requisição que precise de escopo, em vez de escolher um padrão.
- Novo `lib/tenant.ts`: `tenantSlug(env)` (puro, validado) e `tenantId()`
  (resolvido uma vez por render, via o `clientBySlug()` que já existia).
- `clientScope()` em `lib/dal.ts` passa a devolver `Promise<number>` — nunca
  `null` — e perde o parâmetro `wanted`. `requireClientScope()` é removida por
  ter virado redundante.
- **BREAKING** o parâmetro `?cliente=` deixa de existir. É ignorado, não
  rejeitado: uma URL antiga abre a página normal em vez de quebrar.
- `ClientPicker`, `listClients()` e `activeClientIds()` são apagados.
- `clientUsers()` passa a filtrar por `client_id` — antes listava todo usuário
  com papel `client` no banco.
- `--client` no `scripts/invite.ts` vira opcional, com padrão em `TENANT_SLUG`.
- Texto de tela que prometia plural deixa de mentir: "Acesso das clientes" vira
  "Acesso dela"; "o retorno de cada cliente" vira "o retorno dela".
- `canReach` em `lib/scope.ts` fica **intocado**, de propósito — ver design.

## Capabilities

### New Capabilities

Nenhuma. A mudança altera o escopo de uma capacidade existente.

### Modified Capabilities

- `plataforma-de-cliente`: o requisito de isolamento afirmava que "um usuário sem
  vínculo atua como consultor e enxerga **todos**", com o cenário "Consultor
  acessa qualquer cliente". Passa a ser: a instância serve **uma** cliente,
  nomeada por configuração; o consultor enxerga essa, e a diferença entre os
  papéis passa a ser o que cada um pode **fazer**. O isolamento por `client_id`
  continua obrigatório em toda consulta.

## Impact

- **Código:** `lib/tenant.ts` (novo), `lib/dal.ts`, `lib/dashboard.ts`,
  `lib/digest.ts`, `scripts/invite.ts`, as 5 páginas de `app/(app)/`,
  `app/convite/[token]/page.tsx`. `components/client-picker.tsx` removido.
  Saldo: −80 linhas.
- **Banco:** nenhuma migração. `client_id` permanece em todas as tabelas.
- **Operação:** `TENANT_SLUG` entra no `.env` de cada instância. Abrir uma
  segunda cliente passa a ser subir outra instância com outro slug e outro
  banco — não uma linha a mais na mesma tela.
- **Testes:** `test/tenant.test.ts` (novo, 4 casos); os 2 casos de
  `activeClientIds` saem de `test/digest.test.ts`. 193 passando, 85% de
  cobertura.

## Fora de escopo

- **Reescrever `canReach`.** Num banco de uma cliente só, "alcança qualquer
  cliente" e "alcança a cliente da instância" são o mesmo conjunto. Mexer no
  predicado de autorização de carona numa mudança de tenancy é risco sem ganho
  de comportamento.
- **Remover `client_id` do schema.** São 194 referências e a única trava que
  separa os dados de uma cliente dos de outra.
- **Renomear o enum `role`.** `consultant` | `client` já expressa "admin e
  cliente"; renomear custaria migração e não muda nada na tela.
- **A integração com a API do Instagram.** É o próximo passo e depende de um app
  na Meta com redirect URI em domínio próprio. Esta mudança só prepara o terreno.
- **O loop de redirecionamento com sessão morta** descrito em `design.md` —
  defeito pré-existente, encontrado durante a verificação, registrado para ser
  corrigido em mudança própria.

## Métrica observável

Esta mudança não move métrica de Instagram sozinha, e afirmar o contrário seria
inventar número. O que ela habilita é medível: com o tenant fixo, a coleta
automática por API grava `saves`, `reach` e `shares` por post contra um
`client_id` resolvido no servidor. A métrica que passa a ser lida sem export
manual é **`saves/reach`** — hoje em 0,23% contra 1,40% de referência do nicho,
e hoje só observável quando a cliente exporta o Insights à mão.
