# Perfil

> Contexto base da conta. Toda skill lê este arquivo antes de recomendar conteúdo.
> Campos com `[FALTA]` bloqueiam recomendação de conteúdo, mas **não** bloqueiam
> análise de métricas.

**Origem de cada campo:** valor sem marca = fonte verificável (formulário de 03/08/2026,
Insights, ou observação direta do perfil em 04/08/2026). `⚠️ proposta` = interpretação a
validar com a Bianca. `[FALTA]` = não perguntado ainda.

## Identidade

| Campo | Valor |
|---|---|
| @handle | @bianca.olivo |
| Nome de exibição | Bianca Olivo |
| Tipo de conta | **Criador de conteúdo** (verificado: `is_professional_account: true`, `is_business_account: false`) |
| Nicho | **Moda / Lifestyle** |
| Idioma | Português (BR) |
| Seguidores | 713.838 · 8.598 posts · verificada |

> Nota: na resposta 14 do formulário ela descreve a conta como "pessoal, não profissional".
> Não é o caso — é conta de Criador. Ela evitou o tipo **Empresa** por acreditar que perderia
> acesso a áudios em alta e dublagens; essa restrição não se aplica a contas de Criador, que é
> o que ela já usa. Confirmar antes de tratar como decisão informada.

## O que ela declarou querer (13/08/2026)

Respondido por ela mesma, dentro da plataforma. Vale mais que qualquer inferência nossa:

- **Prioridade, na ordem dela:** "primeiro seguidores — segundo comentários e likes —
  terceiro views. Gostaria de chegar a 1M de seguidores até dezembro"
- **Posicionamento comercial:** "não quero criar conteúdos com baixa qualidade. Porque
  quero me posicionar em um nicho mais premium pra fechar publicidades com marcas
  relevantes, porque isso também consequentemente me traz prestígio e prestígio pra minha
  marca my favorite" — o objetivo de receita do perfil é **publi**, não a loja
- **Capacidade:** "tenho bastante tempo e uma equipe pra me ajudar nisso" — a restrição de
  tempo que limitava os ciclos anteriores **não existe**
- **O que ela sabe que funciona:** "pautas onde trago minhas opiniões como perfumes makes
  tendências de moda tbm sempre performam bem e geram uma conversa". Os 376 posts
  concordam: o vídeo de perfumes converteu 41× a série institucional

## Posicionamento

**Frase de posicionamento** (uma frase, específica, testável):

> ⚠️ proposta — validar
> "Mostro no meu dia a dia real como uma marca brasileira se usa lado a lado com as
> internacionais — para a mulher que quer estar pronta do dia à noite sem parecer esforço."

Base: respostas 1, 2 e 4. Ela quer gerar desejo pelas peças através do cotidiano, viagens e
lifestyle, "de uma forma sempre menos comercial", e ser reconhecida como influenciadora
**high fashion** ao lado de marcas internacionais relevantes — usando isso para elevar a
My Favorite ao mesmo patamar ("se eu faço k pro e miu miu, a my tá no mesmo parâmetro").
Quer ser as duas coisas ao mesmo tempo: criadora com autoridade **e** fundadora de marca.

**O que este perfil NÃO é:**

- Não é feed comercial de marca — ela rejeita explicitamente o tom "comercial" (resposta 1)
- Não é conta de dicas genéricas de moda: o diferencial declarado é viver a moda dentro de
  lifestyle, beleza, viagem e família (resposta 8)
- ⚠️ proposta: não é vitrine de e-commerce. Quem quiser catálogo vai ao @myfavorite.oficial

## Bio atual

```
diretora criativa da @myfavorite.oficial
assessoria@biancaolivo.com.br
```

- **Link na bio:** `https://www.myfavorite.com.br` — Adicionado entre 30/07 e 04/08/2026 (na
  auditoria de julho não havia link; resposta 3 dizia que ia incluir).

  **Verificado no perfil dela em 06/08/2026, duas vezes no mesmo dia.** De manhã: sem
  parâmetro nenhum. À tarde: passou a ter `utm_source` e `utm_medium` — mas **nenhum dos dois
  contém `bianca`, `olivo` nem `influencer`**. Contém `ig` e `bio`.

  ⚠️ Isso **não** identifica o canal dela: o @myfavorite.oficial também tem link na bio e cai
  na mesma origem. O painel do sistema procura `influencer/bianca-olivo` e `bianca.olivo` no
  GA4 — nada disso vai aparecer. *Como foi medido:* o classificador de segurança recusa
  devolver query string, então o teste foi por presença de substring, não leitura do valor; e
  pode ser parâmetro do redirecionador `l.instagram.com`. **Conferir no GA4 antes de tratar
  como fato.**

  Correção, que a plataforma agora entrega pronta para copiar em `/plano` (`step.copy_value`):
  `https://www.myfavorite.com.br/?utm_source=influencer&utm_medium=bianca.olivo&utm_campaign=bio`

  **Ela reclamou que fica comprido e feio no perfil.** Metade da objeção não procede — o
  Instagram exibe só `www.myfavorite.com.br`, medido no perfil dela; o endereço inteiro só
  aparece na tela de edição, que só ela vê. A outra metade procede, e a solução é um caminho
  curto no domínio dela: `myfavorite.com.br/bia` → 301 para a URL com etiqueta. A loja é
  **VTEX** (verificado pelo `generator`), então isso se faz em *Storefront → Redirects*, sem
  desenvolvedor. `/bia`, `/bianca` e `/bianca-olivo` estão livres — testados, 404.
  **Enquanto o redirect não existir, encurtar põe um 404 na bio dela**, e o app avisa isso.
- **CTA da bio:** nenhum. A bio descreve cargo e dá e-mail de assessoria; não diz ao visitante
  o que fazer. Com 347.482 visitas ao perfil em 30 dias, é a linha mais cara do perfil.
- **Destaques:** 48 no total, **37 são viagens ou lugares** (portugal, kyoto, osaka, tokyo ×4,
  bahamas, milano, st. moritz, mykonos ×2, nyc ×4, london, barcelona ×2, eurotrip ×2, croácia,
  paris ×2, orlando, santorini, milos, puglia, ibiza, alagoas, irlanda, áfrica do sul,
  seychelles, espanha, curaçao, lad).
  Os 11 restantes: `looks`, `LMEXP`, `José`, `Pipo`, `Velma`, `Receitas`, `HP x MY`,
  `Gestação`, `Religioso`, `Civil`, `👩🏼‍🎓`.
  **Só `looks` trata de roupa.** Nenhum destaque responde "onde comprar", "tamanhos", "frete"
  ou "provador" — que é exatamente o que chega no direct todos os dias (respostas 6 e 13).

## Oferta

| Item | Descrição | Preço | Estágio de funil |
|---|---|---|---|
| Vestido My Favorite | Peça de maior valor percebido; conecta com a feminilidade do público | `[FALTA]` | fundo |
| Calça jeans My Favorite | Reforça a raiz urbana/streetwear da marca; peça democrática | `[FALTA]` | fundo |
| Publicidade de terceiros | k pro, Activia, perfume Miu Miu. Receita dela, não oferta ao seguidor | — | — |

Fonte: respostas 2 e 7. Faixa de preço não foi perguntada.

## Restrições operacionais

| Restrição | Valor |
|---|---|
| Horas/semana disponíveis para conteúdo | `[FALTA]` — não perguntado. **Sem isso, calendário é ficção.** |
| Consegue gravar vídeo? | Sim, com folga — 45 Reels publicados entre 25/06 e 04/08/2026 |
| Tem banco de conteúdo para repurpose? | Sim — 8.598 posts e 48 destaques |
| Quem executa | Só ela: grava, edita e escreve as próprias legendas (respostas 10 e 11). A assessora atua **apenas no direct**, junto com ela, todos os dias (resposta 15) |
| Assuntos proibidos | Nenhum. Declara que todos os temas podem ser abordados e que mostrar bastidor é diferencial (resposta 8) |

## Histórico relevante

| Quando | O que foi tentado | Resultado |
|---|---|---|
| 29/07/2026 | Reel de lançamento da coleção Primavera 27, 1:37 de duração, formato apresentação de produto | **Pior do conjunto medido:** 8% de retenção, 87.196 views, 1.685 curtidas. 33,8% das views vieram de Stories — empurrão manual, não distribuição do algoritmo |
| 08/07 e 11/07/2026 | Reels curtos de cotidiano e humor ("oxi 🍹" 0:09, "diálogos de todo casal" 0:13) | 2,37M e 1,44M views. Retenção 89% e 77%. O de 11/07 fez **5,38% de sends/reach** — mais de 3× a referência do nicho |
| 18/07/2026 | Reel de 3:00 sobre a chegada da filha, em colaboração com @fabioastuchi e outras 2 contas | Maior alcance do período: 3,45M views, 1,45M contas. Retenção 28% — baixa para o nicho, mas compensada pelo tema e pela colab |
| entre 30/07 e 04/08/2026 | Incluiu link na bio (antes eram zero links) | Sem UTM — ainda não rastreável |
| julho/2026 | — | 3º canal de social em receita para o e-commerce: 7.976 sessões, R$ 10.583,28, 23 transações, conversão 0,29% |

---

**Última atualização:** 06/08/2026
