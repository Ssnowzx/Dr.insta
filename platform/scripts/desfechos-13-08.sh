#!/usr/bin/env bash
#
# Os nove desfechos do que a Bianca respondeu em 13/08/2026.
#
# Cada pedido dela ficou em `answered` depois da migração 007 e nenhum tinha
# resposta escrita — que é exatamente o silêncio que a corrente nova existe para
# remover. Isto fecha os nove, cada um dizendo o que aquele material produziu.
#
# Rodar de dentro de platform/, na VPS:
#   bash scripts/desfechos-13-08.sh
#
# Para em qualquer erro: se um título não casar, nada depois roda às cegas.
set -euo pipefail

concluir () {
  npm run --silent pedido -- --buscar "$1" --desfecho "$2"
}

# ---------------------------------------------------------------- os arquivos

concluir 'Uma planilha só' \
'Chegaram os dois: fevereiro a maio e maio a agosto, 376 posts depois de tirar a
sobreposição. E veio uma coluna que muda tudo — "Seguimentos", quantas pessoas
passaram a te seguir por post. É a primeira vez que dá para medir isso post a
post.

O que ela mostra: o vídeo longo de opinião converte 2,4× melhor que o curto, e o
teu de perfumes converteu 41× mais que a série da coleção. A análise inteira está
na aba Análise.

Uma ressalva honesta: esse número continua subindo enquanto o post é antigo, então
comparar fevereiro com agosto é injusto. Comparar tipo de vídeo dentro do mesmo
período, não é.'

concluir 'até onde assistiram' \
'Chegaram oito dos nove — o sétimo tinha o dado indisponível, como você avisou, e
não faz falta.

O que eu vi neles não foi a curva, foi outra coisa: a lista de onde vêm as
visualizações. Nos teus vídeos longos, quase todo mundo que assiste já te segue —
cerca de 1% vem do Explorar e da aba de Reels. Nos curtos é o contrário, 80% vem
de quem não te segue.

Junte com a planilha e o problema aparece inteiro: o conteúdo que faz estranho
querer te seguir quase nunca é mostrado pra estranho. Foi esse achado que trocou o
ciclo.'

concluir 'chega no seu direct' \
'Os seis prints chegaram. Fora os "maravilhosa" e os corações, três respostas
diziam a mesma coisa e eu marquei: "Amooooo seus videos longosss", "Amo quando
posta conteúdo assim" e "Deixa salvo nos destaques".

As três apareceram na sequência da rotina de maquiagem — que é exatamente o
formato que os números mostram convertendo melhor. Sua audiência está pedindo por
escrito o que a planilha aponta. Isso virou o pilar Opinião, 30% do mix.'

# --------------------------------------------------------------- as respostas

concluir 'foi impulsionado' \
'"Não" é a melhor resposta possível aqui. Significa que os 376 posts são
comparáveis entre si: nenhum teve dinheiro por trás inflando o alcance, então
quando um formato performa melhor é mérito dele, não da verba.

Sem isso eu estaria elogiando formato quando a diferença era impulsionamento.'

concluir 'datas dos lançamentos' \
'Anotadas: collab My Favorite × Disney em 15 de junho, publi Miu Miu em 1º de
maio. As duas caem dentro da janela das planilhas.

Servem de régua: pico de alcance nesses dias tem causa conhecida, e agora eu não
leio pico de campanha como se fosse mérito do formato.'

concluir 'engajamento, o que você quer ver mais' \
'Esta é a resposta que trocou o ciclo. Você escreveu: "primeiro seguidores,
segundo comentários e likes, terceiro views" e "gostaria de chegar a 1M até
dezembro".

O ciclo foi redesenhado no mesmo dia. Seguidores viraram a métrica que manda;
comentário desceu para piso — não some do painel, mas não é mais o alvo.

A conta, na mesa desde já: faltam 286.162 em 140 dias, ou 62.200 por mês, três
vezes o ritmo de hoje. Dá para chegar, e não dá só com conteúdo melhor — precisa
disso somado a um evento de escala por mês, do porte do que março fez. Está tudo
escrito na aba Análise.'

concluir 'Quanto tempo por semana' \
'"Tenho bastante tempo e uma equipe pra me ajudar" muda o desenho: todo plano
anterior supunha você sozinha e limitava volume por isso.

Mesmo assim o plano novo não pede mais volume — você já publica cerca de 8 Reels
por semana, e mais do mesmo a 0,06% de conversão só gasta a equipe. O tempo extra
vai para o vídeo de opinião, que rende 41×.'

concluir 'NÃO quer no seu perfil' \
'"Não quero criar conteúdos com baixa qualidade... quero me posicionar em um nicho
mais premium pra fechar publicidades com marcas relevantes."

Isso me deu duas fronteiras. A primeira é o objetivo comercial do perfil: é publi,
não a loja — o que confirma o handoff de 12/08. A segunda é mais útil: pauta cujo
assunto é a marca sai do teu perfil pessoal. Não por qualidade, por conta de
espaço — 179 mil pessoas alcançadas por 45 seguidores não paga o lugar.

Virou o terceiro passo do teu plano.'

concluir 'personagens' \
'Mozão, o time da My, gosto pessoal e sucessão familiar — e você mesma disse que o
vídeo sobre a terceira geração da empresa deu bastante engajamento.

É o pilar Personagens, 10% do mix, quadro nomeado no mesmo dia da semana. A parte
que mais me interessa é a sucessão: é a única pauta em que você tem algo que
ninguém copia, e você já tem evidência de que funciona.

Sobre a assessora responder comentário em público: sim, e isso entra quando a
conversa voltar a ser alvo. Neste ciclo ela é piso, não meta.'

echo
echo "Nove pedidos concluídos."
