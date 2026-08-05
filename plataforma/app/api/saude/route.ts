import { NextResponse } from 'next/server'
import { conexao } from '@/banco/conexao'

/**
 * Sonda de saúde consumida pelo HEALTHCHECK do Dockerfile.
 *
 * Confere o banco de propósito: um app que responde 200 com o banco fora está
 * mentindo para o orquestrador, e o contêiner segue marcado como saudável
 * enquanto nenhuma tela funciona.
 */
export const dynamic = 'force-dynamic'

export async function GET (): Promise<NextResponse> {
  try {
    await conexao().query('SELECT 1')
    return NextResponse.json({ ok: true }, { headers: { 'cache-control': 'no-store' } })
  } catch {
    // A mensagem do driver não vai para a resposta: ela carrega host, usuário
    // e às vezes a query. O detalhe fica no log do contêiner.
    return NextResponse.json(
      { ok: false, erro: 'banco indisponível' },
      { status: 503, headers: { 'cache-control': 'no-store' } }
    )
  }
}
