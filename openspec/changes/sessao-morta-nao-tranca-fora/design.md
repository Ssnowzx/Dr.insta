## Context

Ver `proposal.md — Why`.

A camada que causou o defeito existe por um bom motivo: `proxy.ts` roda em
**toda** requisição, incluindo os prefetches que o Next dispara quando um dedo
passa por cima de um link. Por isso ele não consulta banco — seria uma consulta
por link pré-carregado. O preço dessa economia é que a única evidência que ele
tem é "existe um cookie", e cookie não prova sessão.

Nenhuma dependência nova.

## Goals / Non-Goals

**Goals:**

- Nenhuma sequência de estados deixa alguém sem caminho para a tela de entrar.
- A camada otimista continua sem tocar o banco.
- O `proxy` passa a ter teste, porque foi ele que errou.

**Non-Goals:**

- Reescrever o modelo de sessão. O defeito é de roteamento, não de sessão.
- Detectar o laço em runtime (contador de saltos, cabeçalho de guarda). Trata o
  sintoma e deixa a causa de pé.

## Decisions

### 1. A regra do desvio muda de camada, não de existência

**Escolhido:** `proxy.ts` para de desviar `/entrar` e `/recuperar`; as páginas
passam a fazer o desvio com `currentSession()`.

O comportamento visível para quem está mesmo logado é idêntico — vai para a
home. O que muda é **quem decide**: antes, uma camada que só via um cookie;
agora, a que consulta o banco. E como a decisão saiu do proxy, ela não custa nada
em prefetch: só roda quando a página realmente renderiza.

**Alternativa descartada:** apagar o cookie no `proxy` quando o desvio acontece.
O proxy não sabe se o cookie é bom — apagaria o cookie de quem está legitimamente
logada e visitou `/entrar` por engano, derrubando a sessão dela.

**Alternativa descartada:** simplesmente remover o desvio e deixar quem está
logada ver o formulário de entrar. Fecha o laço, e é a opção mais barata. Custa
uma tela confusa ("já não estou dentro?") num produto de uma cliente só, onde
cada estranheza vira mensagem no WhatsApp.

### 2. A regra geral que sobrou escrita no arquivo

Uma verificação otimista pode **acrescentar** restrição, nunca **remover** uma.
Mandar alguém autenticar por engano é recuperável — a página corrige. Afastar
alguém de uma rota pública por engano pode ser irrecuperável, e foi.

Está no comentário de `proxy.ts` porque é a regra que, quebrada, produziu o
defeito — e o próximo a mexer ali precisa dela antes de escrever a linha.

### 3. Por que não apagar o cookie morto

Apagar exigiria `cookies().delete()` durante render de Server Component, que o
Next recusa fora de Server Action ou Route Handler. E não é necessário: o cookie
morto não abre nada, e `createSession()` o sobrescreve no próximo login. O custo
de deixá-lo é uma consulta de sessão por requisição até lá — que aconteceria de
qualquer forma.

### 4. Limpar a query no desvio

`req.nextUrl.clone()` preserva a query da URL original. Como o `destino` já
carrega os parâmetros codificados dentro de si, a URL saía com cada um duas
vezes: `/entrar?aba=x&destino=%2Fp%3Faba%3Dx`. Sem consequência funcional —
`/entrar` lê só `destino` — mas é um endereço que diz duas coisas onde deveria
dizer uma, e um parâmetro de tela protegida vazando solto para a tela pública.

Achado pelo teste novo, não pela leitura.

## Risks / Trade-offs

- **Duas consultas de sessão a mais, em `/entrar` e `/recuperar`** → São telas
  abertas uma vez por sessão, não em laço. O caminho quente (prefetch) segue sem
  banco.
- **Quem cai por sessão morta perde o `destino`** → Vai para a home em vez da
  tela pedida. Um clique, e o desvio vem de `requireSession()`. Registrado em
  "Fora de escopo".
- **`/recuperar` deixa de ser estática** → Passa a ler cookie, então é dinâmica.
  Ela já não tinha nada cacheável.

## Migration Plan

Deploy do código. Sem migração, sem alteração de dados. Quem estiver preso no
laço sai na primeira requisição depois do deploy, sem limpar nada.

**Rollback:** reverter o commit — e o defeito volta junto.

## Open Questions

**A renovação de cookie dentro de `readSession()` funciona?** Ela chama
`cookies().set()` durante render de Server Component, que é a mesma operação que
a decisão 3 diz ser proibida. Só dispara depois de dois terços dos 90 dias de
sessão, então provavelmente nunca rodou. Se lançar, o efeito é a sessão nunca
renovar e a cliente ser deslogada no dia 90 mesmo usando toda semana.

Não mexi às cegas: não é o defeito relatado, e "corrigir" um caminho que nunca
executou, sem conseguir observá-lo, troca um bug possível por um certo. Verificar
adiantando o relógio ou encurtando `SESSION_TTL_MS` num ambiente de teste, e
tratar em mudança própria.
