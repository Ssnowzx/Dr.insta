---
description: Preenche ou revisa os arquivos de contexto do perfil (perfil, ICP, voz, pilares, metas)
argument-hint: "[arquivo especifico] (opcional — ex.: 'icp', 'voz', 'metas')"
---

Preencha ou revise o contexto do perfil.

Alvo: `$ARGUMENTS`

Passos:

1. Leia os arquivos em `perfil/` e liste o que ainda esta com `[PREENCHER]`.
   - Se `$ARGUMENTS` nomeia um arquivo especifico, trate so ele.
2. Colete o que falta **em uma unica rodada de perguntas**, agrupadas por arquivo. Nao pergunte um campo por mensagem.
3. Para `perfil/voz-e-tom.md`: peca 3 legendas anteriores em vez de descricao de tom. Amostras ensinam mais que adjetivos, e sao o que impede o texto gerado de soar a IA.
4. Para `perfil/icp.md`: as dores precisam vir com as **palavras do publico** — extraidas de DMs, comentarios e caixa de perguntas. Se o usuario nao tiver esse material, ajude-o a mina-lo antes de preencher.
5. Para `perfil/metas.md`: nao aceite meta sem baseline. Se nao houver baseline, o passo anterior e rodar `npm run ig -- analisar <csv>` para levantar.
6. Escreva os arquivos preenchidos e atualize o campo "Ultima atualizacao".

Nao invente conteudo para preencher campo. Um perfil com lacunas honestas e mais util que um preenchido com suposicao — a suposicao vira conteudo que nao converte e so se descobre 60 dias depois.
