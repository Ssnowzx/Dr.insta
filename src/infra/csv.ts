import type { ErroLinha, FormatoPost, PostBruto, ResultadoParse } from '@/tipos/index.js'

/**
 * Leitor de CSV do Instagram Insights.
 *
 * O Insights exporta com nomes de coluna que variam por idioma e por versao, entao
 * o parser aceita varios apelidos por campo em vez de exigir um cabecalho exato.
 * O objetivo e que o usuario cole o export sem precisar renomear nada.
 */

const APELIDOS: Readonly<Record<string, readonly string[]>> = {
  id: ['id', 'post', 'identificador', 'permalink', 'link'],
  data: ['data', 'date', 'data_publicacao', 'publicado_em', 'horario_publicacao'],
  formato: ['formato', 'tipo', 'format', 'type', 'tipo_de_publicacao'],
  pilar: ['pilar', 'pillar', 'categoria', 'tema'],
  legenda: ['legenda', 'caption', 'texto', 'descricao'],
  alcance: ['alcance', 'reach', 'contas_alcancadas', 'contas alcancadas'],
  curtidas: ['curtidas', 'likes', 'gostei'],
  comentarios: ['comentarios', 'comments'],
  salvamentos: ['salvamentos', 'saves', 'salvos', 'salvamento'],
  compartilhamentos: ['compartilhamentos', 'shares', 'sends', 'envios'],
  retencaoMedia: ['retencao_media', 'retencao', 'retention', 'watch_time_pct', 'assistido_medio'],
  alcanceNaoSeguidores: [
    'alcance_nao_seguidores',
    'nao_seguidores',
    'non_followers',
    'pct_nao_seguidores',
  ],
  visitasPerfil: ['visitas_perfil', 'profile_visits', 'visitas'],
  cliquesLink: ['cliques_link', 'link_clicks', 'cliques'],
}

const FORMATOS_VALIDOS: readonly FormatoPost[] = ['reels', 'carrossel', 'imagem', 'story']

const APELIDOS_FORMATO: Readonly<Record<string, FormatoPost>> = {
  reels: 'reels',
  reel: 'reels',
  video: 'reels',
  'video curto': 'reels',
  carrossel: 'carrossel',
  carousel: 'carrossel',
  album: 'carrossel',
  imagem: 'imagem',
  image: 'imagem',
  foto: 'imagem',
  photo: 'imagem',
  post: 'imagem',
  'post unico': 'imagem',
  story: 'story',
  stories: 'story',
}

/** Remove acentos, espacos e caixa para comparar cabecalhos de forma tolerante. */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
}

/**
 * Divide uma linha de CSV respeitando aspas duplas e o escape `""`.
 * Necessario porque legendas frequentemente contem virgulas.
 */
export function dividirLinha(linha: string, separador: string): string[] {
  const campos: string[] = []
  let atual = ''
  let dentroAspas = false

  for (let i = 0; i < linha.length; i += 1) {
    const c = linha[i]

    if (c === '"') {
      if (dentroAspas && linha[i + 1] === '"') {
        atual += '"'
        i += 1
      } else {
        dentroAspas = !dentroAspas
      }
      continue
    }

    if (c === separador && !dentroAspas) {
      campos.push(atual.trim())
      atual = ''
      continue
    }

    atual += c
  }

  campos.push(atual.trim())
  return campos
}

/** Detecta o separador comparando quantos campos cada candidato produz no cabecalho. */
export function detectarSeparador(cabecalho: string): string {
  const candidatos = [',', ';', '\t']
  let melhor = ','
  let maiorContagem = 0

  for (const c of candidatos) {
    const contagem = dividirLinha(cabecalho, c).length
    if (contagem > maiorContagem) {
      maiorContagem = contagem
      melhor = c
    }
  }

  return melhor
}

/** Mapeia nome de coluna do arquivo para o campo canonico do dominio. */
function mapearCabecalho(colunas: readonly string[]): Map<string, number> {
  const mapa = new Map<string, number>()

  colunas.forEach((coluna, indice) => {
    const normalizada = normalizar(coluna)
    for (const [campo, apelidos] of Object.entries(APELIDOS)) {
      if (mapa.has(campo)) continue
      if (apelidos.some((a) => normalizar(a) === normalizada)) {
        mapa.set(campo, indice)
        return
      }
    }
  })

  return mapa
}

/**
 * Converte texto em numero aceitando formato brasileiro (1.234,5) e ingles (1,234.5),
 * alem de sufixo de percentual. Retorna `undefined` quando nao ha valor utilizavel.
 */
export function paraNumero(texto: string | undefined): number | undefined {
  if (texto === undefined) return undefined
  const limpo = texto.trim().replace(/%/g, '').replace(/\s/g, '')
  if (limpo === '' || limpo === '-') return undefined

  // "1.234,5" -> ponto e separador de milhar, virgula e decimal.
  const brasileiro = /^-?\d{1,3}(\.\d{3})*(,\d+)?$/.test(limpo)
  const candidato = brasileiro
    ? limpo.replace(/\./g, '').replace(',', '.')
    : limpo.replace(/,/g, '')

  const valor = Number(candidato)
  return Number.isFinite(valor) ? valor : undefined
}

/** Converte para inteiro nao-negativo; ausencia vira 0. */
function paraContagem(texto: string | undefined): number {
  const valor = paraNumero(texto)
  if (valor === undefined) return 0
  return Math.max(0, Math.round(valor))
}

/** Normaliza a data para ISO `YYYY-MM-DD`, aceitando tambem `DD/MM/YYYY`. */
export function normalizarData(texto: string): string | undefined {
  const limpo = texto.trim()
  if (limpo === '') return undefined

  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(limpo)
  if (iso !== null) return `${iso[1]}-${iso[2]}-${iso[3]}`

  const br = /^(\d{1,2})[/](\d{1,2})[/](\d{4})/.exec(limpo)
  if (br !== null) {
    const dia = (br[1] ?? '').padStart(2, '0')
    const mes = (br[2] ?? '').padStart(2, '0')
    return `${br[3]}-${mes}-${dia}`
  }

  return undefined
}

/** Traduz o rotulo de formato do arquivo para o formato canonico. */
export function normalizarFormato(texto: string | undefined): FormatoPost | undefined {
  if (texto === undefined) return undefined
  const normalizado = normalizar(texto).replace(/_/g, ' ')
  const direto = APELIDOS_FORMATO[normalizado]
  if (direto !== undefined) return direto
  return FORMATOS_VALIDOS.find((f) => f === normalizado)
}

/**
 * Faz o parse de um CSV de posts.
 *
 * Linhas invalidas nao abortam a leitura: elas voltam em `erros` para que o usuario
 * saiba exatamente o que corrigir, enquanto o restante da analise segue.
 */
export function lerCsv(conteudo: string): ResultadoParse {
  const linhas = conteudo
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l !== '')

  const cabecalho = linhas[0]
  if (cabecalho === undefined) {
    return { posts: [], erros: [{ linha: 0, motivo: 'Arquivo vazio.' }] }
  }

  const separador = detectarSeparador(cabecalho)
  const colunas = dividirLinha(cabecalho, separador)
  const mapa = mapearCabecalho(colunas)

  const obrigatorias = ['data', 'formato', 'alcance']
  const faltando = obrigatorias.filter((c) => !mapa.has(c))
  if (faltando.length > 0) {
    return {
      posts: [],
      erros: [
        {
          linha: 1,
          motivo: `Cabecalho sem coluna(s) obrigatoria(s): ${faltando.join(', ')}. Colunas encontradas: ${colunas.join(', ')}.`,
        },
      ],
    }
  }

  const posts: PostBruto[] = []
  const erros: ErroLinha[] = []

  const campo = (valores: readonly string[], nome: string): string | undefined => {
    const indice = mapa.get(nome)
    if (indice === undefined) return undefined
    return valores[indice]
  }

  for (let i = 1; i < linhas.length; i += 1) {
    const numeroLinha = i + 1
    const bruta = linhas[i]
    if (bruta === undefined) continue

    const valores = dividirLinha(bruta, separador)

    const data = normalizarData(campo(valores, 'data') ?? '')
    if (data === undefined) {
      erros.push({
        linha: numeroLinha,
        motivo: `Data invalida ou ausente ("${campo(valores, 'data') ?? ''}"). Use YYYY-MM-DD ou DD/MM/YYYY.`,
      })
      continue
    }

    const formato = normalizarFormato(campo(valores, 'formato'))
    if (formato === undefined) {
      erros.push({
        linha: numeroLinha,
        motivo: `Formato invalido ("${campo(valores, 'formato') ?? ''}"). Use: ${FORMATOS_VALIDOS.join(', ')}.`,
      })
      continue
    }

    const alcance = paraNumero(campo(valores, 'alcance'))
    if (alcance === undefined || alcance < 0) {
      erros.push({
        linha: numeroLinha,
        motivo: `Alcance invalido ou ausente ("${campo(valores, 'alcance') ?? ''}").`,
      })
      continue
    }

    const pilar = campo(valores, 'pilar')?.trim()
    const legenda = campo(valores, 'legenda')?.trim()
    const retencao = paraNumero(campo(valores, 'retencaoMedia'))
    const naoSeguidores = paraNumero(campo(valores, 'alcanceNaoSeguidores'))
    const visitas = paraNumero(campo(valores, 'visitasPerfil'))
    const cliques = paraNumero(campo(valores, 'cliquesLink'))

    posts.push({
      id: campo(valores, 'id')?.trim() ?? `linha-${numeroLinha}`,
      data,
      formato,
      ...(pilar !== undefined && pilar !== '' ? { pilar } : {}),
      ...(legenda !== undefined && legenda !== '' ? { legenda } : {}),
      alcance: Math.round(alcance),
      curtidas: paraContagem(campo(valores, 'curtidas')),
      comentarios: paraContagem(campo(valores, 'comentarios')),
      salvamentos: paraContagem(campo(valores, 'salvamentos')),
      compartilhamentos: paraContagem(campo(valores, 'compartilhamentos')),
      ...(retencao !== undefined ? { retencaoMedia: retencao } : {}),
      ...(naoSeguidores !== undefined ? { alcanceNaoSeguidores: naoSeguidores } : {}),
      ...(visitas !== undefined ? { visitasPerfil: Math.round(visitas) } : {}),
      ...(cliques !== undefined ? { cliquesLink: Math.round(cliques) } : {}),
    })
  }

  return { posts, erros }
}
