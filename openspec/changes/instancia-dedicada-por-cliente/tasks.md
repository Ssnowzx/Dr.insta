> **Estado: implementado e verificado em 06/08/2026.** As tarefas nascem
> marcadas porque a mudança foi construída antes de ser registrada. O que está
> aqui é o relato do que foi feito, não uma lista a fazer.

## 1. Resolução do tenant

- [x] 1.1 Criar `lib/tenant.ts` com `tenantSlug(env)` — puro, recusa ausente e recusa em branco, apara espaços
- [x] 1.2 Adicionar `tenantId()` no mesmo módulo, envolta em `cache()`, resolvendo por `clientBySlug()`, com erro que nomeia a variável e o valor recusado
- [x] 1.3 Escrever `test/tenant.test.ts` — slug válido, espaços aparados, variável ausente, variável em branco (padrão AAA, `should ...`)

## 2. Escopo

- [x] 2.1 `clientScope()` em `lib/dal.ts` passa a devolver `Promise<number>`, sem parâmetro, preservando a precedência do `client_id` da usuária
- [x] 2.2 Remover `requireClientScope()`, redundante com o tipo fechado
- [x] 2.3 Confirmar que `lib/scope.ts` e `test/scope.test.ts` seguem intocados (decisão 4 do `design.md`)

## 3. Telas

- [x] 3.1 `app/(app)/page.tsx`, `plano`, `pedidos` e `conteudo`: trocar a resolução manual por `await clientScope()`, remover `searchParams.cliente` e o ramo do seletor
- [x] 3.2 `conteudo`: remover o prefixo `base` que carregava `cliente=` nos chips de filtro, preservando `duracao` e `marca`
- [x] 3.3 `app/(app)/layout.tsx`: perfil deixa de ser condicional, sai "Visão de consultor", `countUnread` passa a fazer um digest só
- [x] 3.4 `app/(app)/novidades/page.tsx`: um digest em vez de lista, mesmas seções e mesma ordem
- [x] 3.5 `app/(app)/conta/page.tsx`: substituir "Consultor — todos os clientes" por a conta com selo de papel

## 4. Limpeza

- [x] 4.1 Apagar `components/client-picker.tsx`
- [x] 4.2 Apagar `listClients()` de `lib/dashboard.ts` e `activeClientIds()` de `lib/digest.ts`, com o import de `isNull` que ficou órfão
- [x] 4.3 `clientUsers()` passa a receber e filtrar por `clientId`
- [x] 4.4 Remover de `test/digest.test.ts` os dois casos de `activeClientIds`, deixando nota do porquê
- [x] 4.5 Corrigir texto de tela que prometia plural: "Acesso das clientes" → "Acesso dela"; "o retorno de cada cliente" → "o retorno dela"

## 5. Configuração e ferramentas

- [x] 5.1 `scripts/invite.ts`: `--client` vira opcional com padrão em `TENANT_SLUG`, mantendo a exclusão mútua com `--consultant`
- [x] 5.2 Documentar `TENANT_SLUG` no `.env.exemplo` e defini-lo no `.env` local
- [x] 5.3 README: aviso de uma cliente por instância, seção "Tenancy" com as três propriedades a preservar, e a linha do `invite` atualizada

## 6. Verificação

- [x] 6.1 `npm run lint` e `npm run test:coverage` — 193 testes, 85% (mínimo 80%)
- [x] 6.2 `npm run validar:tudo` na raiz — motor, skills e openspec
- [x] 6.3 Navegador, papel consultor: entra e cai direto no painel da cliente, sem seletor; `/plano`, `/pedidos`, `/conteudo`, `/novidades` e `/conta` abrem sem `?cliente=`
- [x] 6.4 Navegador, papel cliente: nav sem "Novidades", `/novidades` redireciona para a inicial, `/conta` sem a seção de acesso
- [x] 6.5 Navegador: `/?cliente=inventado-que-nao-existe` é ignorado e a página é a mesma
- [x] 6.6 Navegador, modo de falha: `TENANT_SLUG` inexistente derruba a tela do consultor com mensagem nomeando variável e valor — e **não** derruba a da cliente, cujo escopo vem do próprio `client_id`
- [x] 6.7 `npm run invite` sem `--client` cria a usuária já vinculada ao tenant (conferido no banco)
- [x] 6.8 Grep final por referências órfãs a `ClientPicker`, `listClients`, `activeClientIds`, `requireClientScope`

## 7. Encaminhado para mudança própria

- [x] 7.1 O laço de redirecionamento com sessão morta descrito no fim do `design.md` virou a mudança `sessao-morta-nao-tranca-fora`, já implementada e verificada em 06/08/2026 — a seção do `design.md` aqui fica como registro de onde o defeito apareceu
