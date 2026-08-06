> **Estado: implementado e verificado em 06/08/2026.** As tarefas nascem
> marcadas porque a correção foi feita antes de ser registrada. É relato, não
> lista a fazer.

## 1. Fechar o laço

- [x] 1.1 Remover de `proxy.ts` o desvio de `/entrar` e `/recuperar` para `/`, deixando uma regra só: sem cookie e rota protegida, manda entrar
- [x] 1.2 Escrever no comentário do arquivo a regra que, quebrada, produziu o defeito — verificação otimista só acrescenta restrição, nunca remove
- [x] 1.3 `app/entrar/page.tsx`: desviar para `/` quando `currentSession()` não for nula
- [x] 1.4 `app/recuperar/page.tsx`: mesmo desvio; a função vira `async`

## 2. Query duplicada no desvio

- [x] 2.1 Limpar `target.search` antes de gravar `destino`, para o endereço de entrar não repetir cada parâmetro solto e dentro do destino codificado

## 3. Testes

- [x] 3.1 Criar `test/proxy.test.ts` — o `proxy` não tinha nenhum, e foi ele que errou
- [x] 3.2 Casos do caminho normal: sem cookie vai para entrar; destino preservado; raiz não ganha destino; rotas públicas passam; requisição com cookie passa
- [x] 3.3 **Caso de regressão:** com cookie, `/entrar` e `/recuperar` NÃO redirecionam
- [x] 3.4 Caso de borda: caminho parecido com rota pública (`/entrar-em-contato`, `/conviteiro`) continua protegido

## 4. Verificação

- [x] 4.1 `npm run lint` e `npm test` — 200 passando (eram 193)
- [x] 4.2 `npm run validar:tudo` na raiz
- [x] 4.3 Navegador, gatilho de produto: entrar com sessão viva, **desativar a usuária** no banco, abrir `/plano` — antes `ERR_TOO_MANY_REDIRECTS`, agora a tela de entrar
- [x] 4.4 Navegador, gatilho de operação: apagar a linha de `session` com o cookie vivo — `/` leva à tela de entrar e `/recuperar` abre
- [x] 4.5 Navegador, caminho feliz preservado: com sessão viva, `/entrar` e `/recuperar` seguem levando para a home
- [x] 4.6 `curl` no desvio: `/pedidos/01ABC?aba=historico` sai como `/entrar?destino=...` sem o `aba` solto

## 5. Herdado da mudança anterior

- [x] 5.1 Atualizar a tarefa 7.1 de `instancia-dedicada-por-cliente`, que apontava este defeito como pendente

## 6. Aberto — não é desta mudança

- [ ] 6.1 Investigar a renovação de cookie em `readSession()`, que chama `cookies().set()` durante render (ver "Open Questions" do `design.md`). Só dispara após 60 dias de sessão, então provavelmente nunca executou; se lançar, a cliente é deslogada no dia 90 mesmo usando toda semana
