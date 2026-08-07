#!/usr/bin/env bash
# Restaura um dump gerado por `backup.sh`.
#
# Existe para que a restauração seja um comando testado, e não um procedimento
# que alguém vai reconstruir de memória no dia em que o banco sumiu — que é
# exatamente o dia com menos calma disponível.
#
# Uso:
#   ./infra/restore.sh backups/db-2026-08-07-1300.sql.gz            # restaura no banco em uso
#   ./infra/restore.sh backups/db-....sql.gz --para ensaio_restore  # restaura noutro banco
#
# O segundo modo é o que se usa para TESTAR o backup: restaura num banco
# separado e compara as contagens, sem tocar no que está no ar.
set -euo pipefail

AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$AQUI"

DUMP="${1:-}"
if [ -z "$DUMP" ] || [ ! -f "$DUMP" ]; then
  echo "Uso: $0 <arquivo.sql.gz> [--para <nome_do_banco>]" >&2
  exit 1
fi

ALVO=""
if [ "${2:-}" = "--para" ]; then ALVO="${3:-}"; fi

if [ ! -f .env ]; then
  echo "Sem .env em $AQUI. Veja .env.exemplo." >&2
  exit 1
fi
set -a; . ./.env; set +a

: "${DB_ROOT_PASSWORD:?DB_ROOT_PASSWORD não está no .env}"
: "${DB_NAME:=myfavorite}"
BANCO="${ALVO:-$DB_NAME}"

if ! gzip -t "$DUMP" 2>/dev/null; then
  echo "$DUMP não abre. Não vou tentar restaurar um arquivo corrompido." >&2
  exit 1
fi

# Restaurar POR CIMA do banco em uso é destrutivo e irreversível. Restaurar
# num banco separado não é — daí a confirmação valer só para o primeiro caso.
if [ -z "$ALVO" ]; then
  echo "ATENÇÃO: isto vai SOBRESCREVER o banco '$BANCO' que está em uso."
  echo "Para testar sem risco: $0 $DUMP --para ensaio_restore"
  printf "Digite o nome do banco para confirmar: "
  read -r CONFIRMA
  if [ "$CONFIRMA" != "$BANCO" ]; then
    echo "Não confere. Nada foi feito."
    exit 1
  fi
fi

echo "Restaurando $DUMP em '$BANCO'…"

docker compose exec -T db mysql -uroot -p"$DB_ROOT_PASSWORD" \
  -e "CREATE DATABASE IF NOT EXISTS \`$BANCO\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

gunzip -c "$DUMP" | docker compose exec -T db mysql -uroot -p"$DB_ROOT_PASSWORD" "$BANCO"

echo
echo "Conferência linha a linha — '$BANCO' contra '$DB_NAME':"
echo

# COUNT(*) e NÃO information_schema.table_rows.
#
# `table_rows` é ESTIMATIVA no InnoDB, e para tabelas pequenas devolve zero com
# frequência. Medido em 07/08/2026: uma restauração perfeita apareceu como
# `client 0`, `user 0`, `step 0` — números que fariam qualquer um concluir que o
# backup falhou. Um conferidor que erra é pior que nenhum, porque é acreditado.
TABELAS=$(docker compose exec -T db mysql -uroot -p"$DB_ROOT_PASSWORD" -N -e "
  SELECT table_name FROM information_schema.tables
   WHERE table_schema = '$BANCO' ORDER BY table_name;" 2>/dev/null | tr -d '\r')

DIVERGIU=0
for t in $TABELAS; do
  origem=$(docker compose exec -T db mysql -uroot -p"$DB_ROOT_PASSWORD" "$DB_NAME" -N \
    -e "SELECT COUNT(*) FROM \`$t\`;" 2>/dev/null | tr -d '\r' || echo "—")
  restaurado=$(docker compose exec -T db mysql -uroot -p"$DB_ROOT_PASSWORD" "$BANCO" -N \
    -e "SELECT COUNT(*) FROM \`$t\`;" 2>/dev/null | tr -d '\r')

  if [ "$origem" = "$restaurado" ]; then
    printf "  %-24s %6s  ok\n" "$t" "$restaurado"
  else
    printf "  %-24s %6s  DIVERGE (em uso: %s)\n" "$t" "$restaurado" "$origem"
    DIVERGIU=1
  fi
done

echo
if [ "$DIVERGIU" -eq 0 ]; then
  echo "Todas as tabelas batem. Este backup restaura."
else
  echo "Alguma tabela não bate. NÃO trate este backup como bom." >&2
  exit 1
fi

# `session` divergir é esperado quando se compara com o banco em uso: alguém
# pode ter entrado entre o dump e a conferência. Qualquer outra, investigue.
