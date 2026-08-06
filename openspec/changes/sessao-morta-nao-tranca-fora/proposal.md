## Why

Cookie de sessão vivo com sessão morta trancava a pessoa **fora da plataforma,
sem saída pelo produto**.

`proxy.ts` mandava `/entrar` → `/` sempre que existisse cookie. `requireSession()`
mandava `/` → `/entrar` sempre que o cookie não resolvesse para sessão viva. As
duas regras se alimentavam e o navegador morria em `ERR_TOO_MANY_REDIRECTS` — não
numa tela de erro do produto, numa tela do Chrome. A única saída era limpar
cookie à mão.

O que dispara não é acidente raro:

- **Desativar um usuário** (`active = 0`). `readSession()` devolve `null` e o
  cookie continua no navegador. É caminho de produto, não falha.
- Restaurar o banco de um backup, ou revogar uma sessão pela tabela.

E agrava porque o produto não manda e-mail: quem cai nisso não tem recuperação
self-service. A tela `/recuperar`, que existe justamente para registrar "não
consegui entrar", era **inalcançável pelo mesmo motivo** — ela também estava na
regra do desvio.

Encontrado em 06/08/2026 verificando a mudança `instancia-dedicada-por-cliente`,
que apenas o registrou. Esta o corrige.

## What Changes

- `proxy.ts` deixa de desviar `/entrar` e `/recuperar` para `/`. Ele passa a ter
  uma regra só: sem cookie e rota protegida, manda entrar.
- O desvio "você já está logado, vá para a home" passa a viver nas próprias
  páginas `/entrar` e `/recuperar`, decidido por `currentSession()` — que
  consulta o banco.
- Correção de tabela junto: `req.nextUrl.clone()` carregava a query original, e a
  URL de entrar saía com cada parâmetro duas vezes — solto e dentro do `destino`
  codificado (`/entrar?aba=x&destino=%2Fp%3Faba%3Dx`). Agora sai só `destino`.
- `test/proxy.test.ts` (novo): o `proxy` nunca tinha teste, e foi ele que causou
  o defeito. Oito casos, um deles fixando exatamente a regressão.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `plataforma-de-cliente`: o requisito de recuperação de acesso sem e-mail
  pressupunha que a tela de recuperação fosse alcançável. Passa a exigir isso
  explicitamente — nenhuma verificação otimista pode afastar alguém de uma rota
  pública, porque a evidência que ela tem (existe um cookie) não prova sessão.

## Impact

- **Código:** `proxy.ts`, `app/entrar/page.tsx`, `app/recuperar/page.tsx`.
- **Banco:** nada.
- **Custo:** uma consulta de sessão em duas telas públicas que ninguém abre em
  laço. `proxy.ts` continua sem tocar o banco — é ele que roda em todo prefetch.
- **Testes:** 200 passando (eram 193), 85% de cobertura.

## Fora de escopo

- **Apagar o cookie morto do navegador.** Ele fica até alguém entrar de novo, e
  `createSession()` o sobrescreve. Apagar exigiria mutação de cookie durante
  render de Server Component, que o Next proíbe. Sem consequência funcional: o
  caminho já termina na tela certa.
- **Preservar o `destino` quando a sessão morre no meio.** Quem é desviada por
  sessão morta cai em `/entrar` sem `destino` e, ao entrar, vai para a home em
  vez da página que pediu. É um clique, e o desvio vem de `requireSession()`, não
  do proxy.
- **A renovação de cookie dentro de `readSession()`**, que chama `cookies().set()`
  durante render. Só dispara depois de 60 dias de sessão, então nunca foi
  exercitada — anotado no `design.md` para ser investigado, não corrigido às
  cegas aqui.

## Métrica observável

Nenhuma métrica de Instagram se move com isto, e forçar uma seria invenção. O
que se mede é binário e foi medido no navegador: com usuária desativada e cookie
vivo, `/plano` levava a `ERR_TOO_MANY_REDIRECTS` e passou a levar à tela de
entrar. O efeito de negócio é a cliente não ficar sem caminho de volta numa
plataforma que não manda e-mail.
