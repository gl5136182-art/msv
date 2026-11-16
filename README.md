# MSV — Melhore Sua Visão

PWA interno da Manserv para dar visibilidade a itens parados nos almoxarifes das UTs. O sistema permite cadastrar e localizar itens, consultar o estoque e comparar o custo de uma transferência com o de uma compra nova.

## Funcionalidades atuais

- Autenticação por e-mail ou CPF, troca obrigatória de senha e administração de usuários e UTs.
- Cadastro de itens com fotos, quantidade, valor de reposição, dimensões e peso.
- Vitrine com busca, filtros, paginação e detalhes do item.
- Cotação real de transportadoras pela SuperFrete, comparação com veículo próprio e compra nova, e recomendação opcional por IA.
- Dashboard com itens na vitrine, valor parado, valor e itens transferidos e gráficos.
- Vínculo de colaboradores e almoxarifes a múltiplas UTs.
- Papel temporário de moderador para apresentações, com acesso aos demais perfis.
- PWA instalável, com cache somente de arquivos estáticos.

Solicitações de transferência e requisições de compra foram removidas do escopo atual. A cotação de frete é apenas informativa: não contrata envio nem altera o estoque.

## Stack

- Next.js 16, React 19 e TypeScript
- Tailwind CSS 4 e shadcn/ui
- Prisma 7 com PostgreSQL do Supabase
- Better Auth
- Supabase Storage para as fotos
- Serwist para o PWA
- Vitest para os testes

## Configuração local

### Pré-requisitos

- Node.js compatível com Next.js 16 e npm
- Um projeto Supabase com PostgreSQL e um bucket privado para as fotos

### Passos

1. Instale as dependências:

   ```bash
   npm install
   ```

2. Crie o arquivo de ambiente e preencha as variáveis:

   ```bash
   cp .env.example .env
   ```

   No Windows, também é possível copiar o arquivo pelo Explorer ou usar `Copy-Item .env.example .env` no PowerShell. O `.env.example` documenta as conexões do Supabase, autenticação, storage, IA, SuperFrete e seed do primeiro administrador. Nenhum segredo deve ser commitado.

3. Aplique as migrations e gere o client do Prisma:

   ```bash
   npx prisma migrate deploy
   npx prisma generate
   ```

4. Crie as UTs do CSV e o primeiro administrador:

   ```bash
   npm run seed
   ```

   O seed exige `SEED_ADMIN_NOME`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_CPF` e `SEED_ADMIN_SENHA`. Ele pode ser executado novamente sem trocar a senha de um administrador existente.

5. Inicie o desenvolvimento:

   ```bash
   npm run dev
   ```

   Acesse [http://localhost:3000](http://localhost:3000).

## Comandos

| Comando | Uso |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Gera o service worker e o build de produção |
| `npm start` | Executa o build de produção |
| `npm run lint` | ESLint |
| `npm run typecheck` | Typegen do Next e checagem do TypeScript |
| `npm test` | Testes com Vitest |
| `npm run seed` | UTs e primeiro administrador |
| `npm run seed:demo` | Dados fictícios de demonstração |
| `npm run seed:demo:limpar` | Remove os dados de demonstração |
| `npm run importar:inventario -- <arquivo.xlsx> [--dry-run]` | Importa o inventário do almoxarifado |
| `npm run importar:inventario:limpar` | Remove os itens importados pelo script |
| `npm run sw` | Gera `public/sw.js` |

Antes de concluir alterações no código, execute:

```bash
npm run lint && npm run typecheck && npm test
```

## Estrutura

```text
prisma/                 schema, migrations e seeds
public/                 marca, ícones e service worker gerado
scripts/                geração de ícones e service worker
src/app/                rotas e telas do App Router
src/components/         componentes visuais compartilhados
src/modules/            módulos de domínio em actions/services/repositories
src/infra/              banco, autenticação, storage, e-mail, IA e frete
src/lib/                utilitários e regras compartilhadas
src/sw/                 origem do service worker
```

## Documentação

- `Docs/spec.md`: regras de negócio e escopo atual.
- `Docs/CLAUDE.md`: arquitetura e convenções de desenvolvimento.
- `Docs/DESIGN.md`: identidade visual e diretrizes de interface.
- `Docs/TODO.md`: histórico de implementação e pendências.
- `Docs/relatorio-analise.md`: auditoria histórica de 19/10/2026; não representa integralmente o código atual.
