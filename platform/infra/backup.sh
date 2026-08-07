#!/usr/bin/env bash
# Backup do banco e dos arquivos enviados.
#
# O README descrevia o comando de dump e mandava "restore once into an empty
# database" — o que nunca tinha sido feito. Este script existe para que o
# backup e a restauração sejam a MESMA coisa testada, e não duas receitas
# escritas em momentos diferentes.
#
# Uso:
#   ./infra/backup.sh                    # grava em ./backups
#   ./infra/backup.sh /destino           # grava onde você mandar
#
# No cron do host, diário, em /etc/cron.d/myfavorite-backup. Roda como root:
# alcançar o socket do Docker equivale a root na máquina, então o usuário do
# site fica fora do grupo `docker` de propósito.
#
#   0 7 * * * root cd /home/drinsta/myfavorite/platform && ./infra/backup.sh >> /var/log/myfavorite-backup.log 2>&1
#
# 07:00 UTC = 04:00 no Brasil, e DEPOIS da coleta das 06:00 — um dump anterior
# à coleta do dia é um arquivo que não contém o que o nome dele promete.
#
# Restaurar: ./infra/restore.sh <arquivo.sql.gz>
set -euo pipefail

AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DESTINO="${1:-$AQUI/backups}"
RETENCAO_DIAS=14

cd "$AQUI"

# O `.env` é lido aqui e não exportado para o ambiente inteiro: o dump precisa
# da senha de root, e ela não deve vazar para nada mais que este script.
if [ ! -f .env ]; then
  echo "Sem .env em $AQUI. Veja .env.exemplo." >&2
  exit 1
fi
set -a; . ./.env; set +a

: "${DB_ROOT_PASSWORD:?DB_ROOT_PASSWORD não está no .env}"
: "${DB_NAME:=myfavorite}"

mkdir -p "$DESTINO"
CARIMBO="$(date +%F-%H%M)"
SQL="$DESTINO/db-$CARIMBO.sql.gz"

echo "Banco -> $SQL"
# `--single-transaction` para não travar a escrita durante o dump, que numa
# instância única significaria a cliente vendo erro no meio de uma leitura.
docker compose exec -T db mysqldump \
  -uroot -p"$DB_ROOT_PASSWORD" \
  --single-transaction --routines --triggers \
  "$DB_NAME" | gzip > "$SQL"

# Um dump vazio é o modo de falha silencioso deste script: o pipe engole o erro
# do mysqldump e o gzip grava um arquivo válido de 20 bytes. Sem esta checagem,
# o backup "existe" todo dia e não serve em nenhum.
TAMANHO=$(wc -c < "$SQL")
if [ "$TAMANHO" -lt 1024 ]; then
  echo "Dump saiu com $TAMANHO bytes — isso não é um backup. Verifique a senha e o nome do banco." >&2
  rm -f "$SQL"
  exit 1
fi

if ! gzip -t "$SQL" 2>/dev/null; then
  echo "O arquivo não abre. Removido." >&2
  rm -f "$SQL"
  exit 1
fi

# Os arquivos enviados pela cliente. Ficam em bind mount justamente para o
# backup poder lê-los do host, sem entrar no contêiner.
ORIGEM_ARQ="${FILES_HOST:-./files}"
if [ -d "$ORIGEM_ARQ" ]; then
  echo "Arquivos -> $DESTINO/arquivos/"
  mkdir -p "$DESTINO/arquivos"
  rsync -a --delete "$ORIGEM_ARQ/" "$DESTINO/arquivos/"
else
  echo "Aviso: $ORIGEM_ARQ não existe — nenhum arquivo copiado."
fi

# Retenção. Só dos dumps: os arquivos são um espelho, não um histórico.
find "$DESTINO" -maxdepth 1 -name 'db-*.sql.gz' -mtime "+$RETENCAO_DIAS" -delete

echo "Pronto. $(du -h "$SQL" | cut -f1) em $SQL"
echo "Guardados: $(find "$DESTINO" -maxdepth 1 -name 'db-*.sql.gz' | wc -l | tr -d ' ') dump(s)."
