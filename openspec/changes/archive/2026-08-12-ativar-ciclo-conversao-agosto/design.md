## Context

Ver `proposal.md — Why` para a motivação. O que importa aqui como restrição:

- A cliente produz e escreve tudo sozinha (~8 Reels/semana). Qualquer plano que aumente volume será abandonado.
- Não há Graph API. Todo dado entra por print, CSV manual ou painel de receita do e-commerce, que é operado por terceiros.
- O canal com a cliente é uma página HTML publicada, sem conversa acompanhando. A página é a conversa.
- Os baselines de julho foram medidos **sem link na bio** — a linha de base vai mudar de patamar assim que o link passar a ser rastreado, independentemente de qualquer mudança editorial.
- `openspec/specs/` está vazio. Estas são as duas primeiras capacidades do projeto.

## Goals / Non-Goals

**Goals:**
- Tornar a contribuição do canal da criadora mensurável antes de tentar aumentá-la
- Ativar as mudanças numa ordem que permita atribuir causa a cada uma
- Manter intacto o que já distribui a conta, para não trocar um problema por outro

**Non-Goals:**
- Definir alvo numérico neste momento — o baseline muda de patamar com a UTM
- Alterar código em `src/`. O motor já calcula tudo o que é preciso; muda apenas o `--nicho`
- Automatizar a coleta de dados. Continua manual neste ciclo

## Decisions

### D1 — UTM primeiro, isolada, antes de qualquer mudança editorial

**Escolha:** ativar o rastreamento sozinho e só na semana seguinte mexer em conteúdo.

**Por quê:** a UTM não é experimento, é o instrumento de medida. Ativá-la junto com o mix editorial produziria um período com duas variáveis novas, e a subida de sessões seria atribuível tanto ao link recém-rastreado quanto ao conteúdo — sem como separar.

**Alternativa considerada:** ativar tudo junto para ganhar duas semanas. Rejeitada: o ciclo inteiro se apoia em saber o que funcionou, e essa economia destruiria a única leitura limpa disponível.

### D2 — `utm_campaign` distinto por superfície

**Escolha:** `bio` e Stories com campanhas separadas, mantendo `utm_source=influencer` e `utm_medium=<handle>` da convenção já existente no painel.

**Por quê:** a pergunta central do ciclo é se o caminho permanente (bio, destaques) contribui além do empurrão manual diário (Stories). Sem separar a campanha, as duas somam numa linha só e a pergunta fica sem resposta.

**Alternativa considerada:** uma UTM única para tudo. Rejeitada por perder exatamente a distinção que motiva o ciclo.

### D3 — Formato de produto ancorado em evidência da própria conta, não em teoria

**Escolha:** adotar demonstração natural no ambiente da criadora como formato padrão de produto, e evitar apresentação institucional em vídeo longo.

**Por quê:** há um par observado na mesma semana, com a mesma coleção e a mesma audiência — um formato converteu 0,66% no dia, o outro reteve 8%. É comparação com variável quase isolada, o mais próximo de um teste controlado que o material permite.

**Risco assumido:** um dia único não é amostra. Por isso entra como experimento com critério de 4 repetições, não como regra fechada.

### D4 — Entrega em etapas, com corte por natureza da recomendação

**Escolha:** vai para o documento escrito o que a cliente executa sozinha; fica para conversa o que corrige trabalho autoral dela (voz, escrita, decisões já justificadas).

**Por quê:** a página chega sem ninguém junto para contextualizar. Uma correção de voz lida em documento soa como julgamento e custa a adesão de todo o resto — inclusive dos itens que ela executaria sem atrito.

**Alternativa considerada:** entregar o plano completo de uma vez. Rejeitada por concentrar risco de rejeição no primeiro contato do ciclo.

### D5 — Ordem entre conversão e crescimento

**Escolha:** conversão neste ciclo; captação de seguidores no seguinte.

**Por quê:** a conta já cresce sozinha (+20.824 em 30 dias) e a audiência já é a compradora. Trazer mais gente para um caminho quebrado multiplica o vazamento em vez de receita.

## Risks / Trade-offs

- **Alcance médio cai quando o mix mudar** → declarar antes da ativação e acompanhar `sends/reach` do pilar de distribuição como controle; se ele cair, a realocação foi longe demais
- **O painel de receita é operado por terceiros** e hoje fragmenta a origem em duas grafias → somar as variações em toda leitura e pedir unificação; até lá, nenhum número de canal sai de uma linha só
- **A cliente pode desfazer a mudança na terceira semana** ao ver views caindo → efeito colateral declarado por escrito na entrega, antes de começar
- **Amostra pequena:** 6 Reels em 13 dias, abaixo do mínimo de 7 posts e 14 dias → tratar como indício; nenhuma conclusão é promovida a regra antes do mínimo
- **Um único dia sustenta a decisão de formato** → critério de 4 repetições antes de virar prática fixa
- **Dado de negócio em página de acesso público** → não indexação no documento e no cabeçalho; contato fora de texto literal

## Migration Plan

1. Corrigir a UTM da bio e rodar isolada por 30 dias
2. Na semana seguinte, ativar mix editorial e voz única para conteúdo de marca
3. Fixar alvo de sessões e receita só após 30 dias de UTM ativa
4. **Rollback:** todas as mudanças são reversíveis em minutos — restaurar o link anterior e retomar o mix antigo. Nenhuma altera código ou dado histórico

## Open Questions

- Faixa de preço das peças e horas/semana disponíveis para conteúdo seguem em aberto em `perfil/`. Não bloqueiam este ciclo; bloqueiam a montagem de calendário
- A data exata do dia de conversão 0,66% não foi informada, então aquele dia não pode ser cruzado com os Insights do post específico
