# 💰 planeja-fácil — Backend

> Um app de finanças pessoais simples, porém robusto. Organize suas receitas e despesas mês a mês, colabore com outras pessoas no mesmo ano financeiro, e nunca perca o controle do que sobra no fim do mês.

Este é um projeto pessoal de estudo, construído com escopo enxuto e propósito: focar no essencial primeiro e evoluir de forma incremental, sem acumular complexidade desnecessária. Cada decisão de arquitetura aqui foi pensada (e discutida) de propósito, não só copiada de um tutorial.

---

## 🧱 Stack

| Camada | Tecnologia |
|---|---|
| Framework | [NestJS 11](https://nestjs.com/) |
| ORM | [Prisma 7](https://www.prisma.io/) (driver adapter, client customizado) |
| Banco de dados | PostgreSQL (via Docker Compose) |
| Autenticação | JWT (access token) + refresh token rotativo em cookie `httpOnly` |
| E-mail transacional | [Resend](https://resend.com/) |
| Validação | `class-validator` + `class-transformer` |
| Documentação da API | Swagger / OpenAPI (`@nestjs/swagger`) |
| Qualidade | ESLint (flat config) + Prettier |
| Testes | Jest (configurado, cobertura ainda pendente) |

---

## ✨ O que já está implementado

### 🔐 Autenticação

O módulo mais denso do projeto até agora — e onde mais decisões de segurança foram tomadas conscientemente:

- **Cadastro, login, confirmação de conta e recuperação de senha** completos
- **Login não bloqueia usuários com e-mail não confirmado** — por design. A confirmação vira um aviso dentro da plataforma, não uma barreira de entrada
- **Refresh token com rotação e detecção de reuso**: a cada `/auth/refresh`, o token antigo é revogado e um novo é emitido. Se um token *já revogado* for reenviado (sinal de possível roubo), **todas** as sessões daquele usuário são revogadas de uma vez
- **Refresh token vive em cookie `httpOnly`**, nunca no corpo da resposta — o JavaScript do frontend não tem como acessá-lo, nem por engano, nem via XSS
- **Todos os tokens (refresh, verificação de e-mail, redefinição de senha) são armazenados como hash SHA-256** — o valor "cru" só existe no e-mail enviado ou no cookie do navegador, nunca em texto plano no banco
- **Falha no envio de e-mail nunca derruba o cadastro** — é tratado como best-effort; o usuário é criado normalmente mesmo que o provedor de e-mail esteja fora do ar

### 📅 Years (anos financeiros)

- CRUD completo, com sistema de **colaboração multiusuário**
- Três papéis por ano: `ADMIN` (criador), `EDITOR` (mexe nos cards) e `PARTICIPANTE` (só visualiza)
- Convites por e-mail (exige que o convidado já tenha conta)
- Guard de permissão (`YearRolesGuard`) reutilizado em todos os módulos que dependem de contexto de ano

### 🗓️ MonthCards (cards mensais)

- Um card por mês, com o limite de **12 por ano garantido a nível de banco** (constraint única `[yearId, month]` — não é só validação de aplicação)
- **Soft delete com restauração**, respeitando o limite de 12 cards ativos
- **Criação aninhada**: já é possível cadastrar rendas e despesas junto com o card, numa única requisição
- Suporte a atualização parcial (`PATCH`) pensado pra autosave no frontend

### 💵 Entries (Incomes & Expenses)

- CRUD individual de rendas e despesas, pra edição pós-criação
- Validação de propriedade em cascata: todo item confere se pertence ao card certo, e se o card pertence ao ano certo — fecha brechas de acesso indevido entre usuários de anos diferentes

### 🛡️ Infraestrutura e robustez

- **Filtro global de exceções**, padronizando o formato de erro de toda a API — inclusive traduzindo erros crus do Prisma (constraint única, registro não encontrado, chave estrangeira) pra respostas HTTP com sentido, em vez de vazarem como `500`
- **Swagger** documentando a API interativamente
- Configuração cuidadosa de `ValidationPipe` (whitelist, rejeição de campos inesperados, transformação automática de payload — essencial pra validação aninhada funcionar)

---

## 📂 Estrutura de módulos

```
src/
├── modules/
│   ├── auth/           # cadastro, login, refresh, logout, recuperação de senha
│   ├── users/           # CRUD básico de usuários
│   ├── mail/             # integração com Resend
│   ├── years/           # anos financeiros + colaboração
│   ├── month-cards/     # cards mensais
│   ├── entries/
│   │   ├── incomes/     # rendas
│   │   └── expenses/    # despesas
│   └── prisma/           # PrismaService (client + driver adapter)
└── common/
    ├── guards/            # YearRolesGuard
    ├── decorators/       # @YearRoles, @CurrentUser
    ├── filters/           # GlobalExceptionFilter
    ├── types/              # barrel único pros tipos do Prisma
    └── utils/              # geração/hash de tokens
```

---

## 🚀 Rodando localmente

### Pré-requisitos
- Node.js 20+
- Docker (pro Postgres)
- Uma conta no [Resend](https://resend.com/) (free tier serve)

### Passo a passo

```bash
# instalar dependências
yarn install

# subir o banco
docker compose up -d

# configurar variáveis de ambiente
cp .env.example .env
# preencha DATABASE_URL, JWT_ACCESS_SECRET, RESEND_API_KEY, etc.

# rodar as migrations
yarn prisma migrate dev

# subir o servidor em modo dev
yarn dev
```

A API sobe em `http://localhost:3000`, e a documentação interativa fica em `http://localhost:3000/docs`.

### Variáveis de ambiente

| Variável | Descrição |
|---|---|
| `DATABASE_URL` | String de conexão do PostgreSQL |
| `JWT_ACCESS_SECRET` | Segredo usado pra assinar o access token |
| `RESEND_API_KEY` | Chave de API do Resend |
| `MAIL_FROM` | Endereço de envio (formato `Nome <email@dominio.com>`) |
| `FRONTEND_URL` | URL do frontend (usada em CORS e nos links dos e-mails) |
| `NODE_ENV` | `development` ou `production` (afeta a flag `secure` do cookie) |
| `PORT` | Porta do servidor (default `3000`) |

---

## 🗺️ Próximos passos

- [ ] Endpoint de reenvio de e-mail de confirmação
- [ ] Terminar a documentação do Swagger nos módulos restantes
- [ ] Seed script pra popular o banco com dados de teste
- [ ] Testes automatizados (começando pelos fluxos críticos de autenticação)

---

## 📝 Licença

Este projeto está sob a licença [MIT](./LICENSE).
