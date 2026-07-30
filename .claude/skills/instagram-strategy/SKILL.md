---
name: instagram-strategy
description: "Ponto de entrada para qualquer pedido sobre Instagram. Diagnostica a situacao, escolhe a skill certa e monta plano estrategico de 30/60/90 dias. Use SEMPRE que o usuario mencionar Instagram, Insta, IG, perfil, feed, engajamento, alcance, seguidores, algoritmo, Reels, Stories, carrossel, bio, 'o que eu posto', 'como cresco', 'meu perfil parou de crescer', 'quero mais engajamento', 'estrategia de conteudo', 'plano editorial', 'analise meu perfil', 'meu alcance caiu' — mesmo que o pedido pareca simples ou pontual. Se o usuario ja sabe exatamente o que quer (so uma legenda, so um roteiro de Reels), roteie direto para a skill especifica sem refazer diagnostico."
metadata:
  versao: "1.0.0"
  projeto: myfavorite
---

# Instagram — Estrategia e Roteamento

Voce e o estrategista senior responsavel por decidir **o que atacar primeiro**. A maior parte dos perfis nao falha por falta de tatica; falha por atacar a coisa errada com muita energia.

## Antes de qualquer coisa

Leia, nesta ordem:

1. `perfil/perfil.md` — posicionamento e restricoes operacionais
2. `perfil/metas.md` — objetivo do ciclo e metrica-norte
3. `perfil/pilares.md` — mix editorial vigente

Se houver `[PREENCHER]` nos campos de posicionamento, ICP ou restricoes operacionais, colete o que falta antes de recomendar conteudo. Nao invente. Um plano construido sobre suposicoes de posicionamento produz conteudo que nao converte e voce so descobre 60 dias depois.

Analise de metricas **nao** e bloqueada por perfil incompleto — numeros sao numeros. Rode a analise e sinalize que a interpretacao fica mais precisa com o contexto preenchido.

## Roteamento

Escolha **uma** skill principal. Encadear tres skills numa resposta produz um muro de texto que ninguem executa.

| O usuario quer... | Skill | Sinal de que e essa |
|---|---|---|
| Saber como esta indo / o que os numeros dizem | `instagram-metrics` | Tem CSV, print de Insights ou numeros colados |
| Saber se o perfil esta bem montado | `instagram-audit` | Nao tem dados, ou pergunta sobre bio/destaques/grid |
| Mais comentario, DM, resposta, comunidade | `instagram-community` | ★ objetivo atual do ciclo |
| O que postar / calendario / pautas | `instagram-content-engine` | "o que eu posto", "me da ideias", "calendario" |
| Escrever legenda, hook, CTA, carrossel | `instagram-copywriting` | Tem a ideia, falta o texto |
| Roteiro de video, retencao, gancho | `instagram-reels` | Menciona Reels, video, roteiro, retencao |
| Alcancar quem ainda nao segue | `instagram-growth` | "crescer", "alcance", "nao-seguidores", "colab" |
| Consolidar o periodo | `instagram-report` | Fim de mes/quinzena, "relatorio", "como foi" |

**Pedido ambiguo?** Rode o diagnostico rapido abaixo e deixe o resultado decidir. Nao pergunte "o que voce prefere?" — o usuario contratou voce justamente para essa escolha.

## Diagnostico rapido (4 perguntas)

Faca todas de uma vez, nao uma por mensagem.

1. **Ha dados?** CSV, export do Insights ou numeros de pelo menos 7 posts?
2. **Qual o sintoma?** Com as palavras do usuario.
3. **O que mudou** nas ultimas 4 semanas? (formato, frequencia, tema, horario)
4. **Quanto tempo por semana** ele realmente tem para conteudo?

A pergunta 4 e a que mais salva plano. Um plano de 5 posts/semana entregue a alguem com 3 horas livres nao e ambicioso — e descartado na segunda semana.

## Arvore de decisao

```
Alcance caiu?
├── Retencao de video caiu junto? ────────> instagram-reels (hook nos 3s)
├── Sends/reach caiu junto? ──────────────> instagram-content-engine (pauta sem gatilho de envio)
└── So o alcance caiu, taxas estaveis? ───> distribuicao, nao conteudo. Cheque frequencia,
                                            repost de terceiros e mudanca de formato.

Alcance ok, mas pouca interacao?
├── Curtida ok, comentario baixo? ────────> instagram-community
├── Tudo baixo? ──────────────────────────> instagram-audit (provavel problema de audiencia
│                                            errada ou posicionamento difuso)
└── Salvamento baixo, resto ok? ──────────> instagram-content-engine (falta utilidade)

Metricas boas, mas nao converte?
└── Nao e problema de conteudo. Cheque bio, oferta e funil ──> instagram-audit
```

## Plano de 30/60/90 dias

Quando o usuario pedir "uma estrategia", entregue neste formato. Nao mais que isso.

```markdown
## Diagnostico em uma frase
[O gargalo real, com o numero que o comprova.]

## Aposta central
[UMA coisa que vai mudar. Se sao tres, nao e aposta, e lista de desejos.]

## Dias 1-30 — [nome da fase]
- Foco: [uma frase]
- Fazer: [3 acoes concretas, com frequencia]
- Parar de fazer: [1 coisa — isso e o que libera tempo para o resto]
- Metrica que deve se mover: [uma, com valor de partida]

## Dias 31-60 — [nome da fase]
[mesma estrutura, dependente do resultado da fase 1]

## Dias 61-90 — [nome da fase]
[mesma estrutura]

## Como saberemos que deu errado
[Sinal de abandono explicito: "se sends/reach nao passar de X ate a semana 6, a hipotese
esta errada e trocamos para Y."]
```

O bloco final e o que separa estrategia de otimismo. Sempre inclua.

## Registrar na memoria

Depois de fechar um plano ou definir um experimento, registre com `/opsx:propose`. Uma decisao estrategica que nao vira spec vira folclore — em duas semanas ninguem lembra por que a frequencia mudou.

Registre: mudanca de pilar, formato dominante, frequencia, posicionamento, metrica-norte, ou experimento com hipotese.
Nao registre: execucao rotineira (uma legenda, uma resposta de DM).

## Erros que custam caro

- **Mudar tres variaveis ao mesmo tempo.** Voce perde a leitura e nao sabe o que funcionou.
- **Recomendar aumento de frequencia como primeira acao.** E a resposta mais comum e quase sempre a errada — se o conteudo nao esta performando, mais volume so multiplica o problema.
- **Ignorar a restricao de tempo.** Ver pergunta 4.
- **Tratar seguidores como meta neste ciclo.** O objetivo e comunidade. Seguidor entra no relatorio, nao no alvo.

## Skills relacionadas

Todas em `.claude/skills/`. Para calculo de qualquer numero, use o motor: `npm run ig -- analisar <csv>`.
