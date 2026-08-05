import type { NextConfig } from 'next'

/**
 * `standalone` empacota o servidor com só as dependências que ele de fato
 * importa. A imagem final não carrega `node_modules` inteiro — na VPS isso é
 * a diferença entre uma imagem de ~150 MB e uma de ~1 GB.
 */
const config: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  reactStrictMode: true,

  /* `plataforma/` fica dentro do repo Myfavorite, que tem o próprio
     package-lock.json. Sem fixar a raiz aqui, o Turbopack acha os dois
     lockfiles e escolhe um — e a escolha muda conforme de onde o build é
     disparado. Fixar torna o build igual na máquina e na VPS. */
  turbopack: {
    root: import.meta.dirname
  },

  /* Documento de cliente carrega receita, conversão e demografia. A regra
     vale para o domínio inteiro, não página a página: uma tela nova nasce
     protegida sem ninguém precisar lembrar. */
  async headers () {
    return [
      {
        source: '/:caminho*',
        headers: [
          { key: 'x-robots-tag', value: 'noindex, nofollow, noarchive' },
          { key: 'referrer-policy', value: 'no-referrer' },
          { key: 'x-content-type-options', value: 'nosniff' },
          { key: 'x-frame-options', value: 'DENY' },
          { key: 'permissions-policy', value: 'camera=(), microphone=(), geolocation=()' }
        ]
      }
    ]
  }
}

export default config
