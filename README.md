# FinOpenPOS

Open-source Point of Sale (POS) and inventory management system for small retail and service businesses. Built with Next.js 16, React 19, Drizzle ORM, PostgreSQL, Dexie, and PWA offline cache. Run locally with `bun install && bun run dev`.


## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [Scripts](#scripts)
- [Project Structure](#project-structure)
- [API](#api)
  - [Interactive Docs](#interactive-docs)
  - [tRPC Procedures](#trpc-procedures)
- [Testing](#testing)
- [Docker Deploy](#docker-deploy)
- [Database](#database)
  - [Schema](#schema)
- [PostgreSQL](#postgresql)
- [Local-first browser cache](#local-first-browser-cache)
- [Contributing](#contributing)
- [License](#license)

## Features

### Business
- **Dashboard** with interactive charts (revenue, expenses, cash flow, profit margin)
- **Product Management** with categories and stock control
- **Customer Management** with active/inactive status
- **Order Management** with items, totals and status tracking
- **Point of Sale (POS)** for quick sales processing
- **Cashier** with income and expense transaction logging
- **Authentication** with email/password via Better Auth
- **API Documentation** auto-generated interactive docs via Scalar at `/api/docs`

### Operations
- **Transaction Management** with income/expense categories
- **Nested Admin Navigation** for transaction list and category setup
- **Company Settings** for business profile and Indonesian address data
- **Payment Tracking** with paid, partial and unpaid order status
- **Invoice View** with order item snapshots and print action

## Architecture

```mermaid
flowchart LR
  Browser["Browser React 19"]
  Proxy["proxy.ts (session check)"]
  tRPC["tRPC v11 (superjson)"]
  Auth["Better Auth (session cookie)"]
  Drizzle["Drizzle ORM"]
  PostgreSQL["PostgreSQL"]
  Scalar["Scalar /api/docs"]

  Browser -->|HTTP request| Proxy
  Proxy -->|authenticated| tRPC
  Proxy -->|/api/auth/*| Auth
  tRPC -->|protectedProcedure| Drizzle
  Drizzle -->|SQL| PostgreSQL
  tRPC -.->|OpenAPI spec| Scalar
  Auth -->|session| PostgreSQL
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router) |
| UI | React 19, Tailwind CSS 4, Radix UI, Recharts |
| Database | PostgreSQL server + Dexie browser cache |
| ORM | Drizzle ORM |
| API | tRPC v11 (end-to-end type safety) |
| Auth | Better Auth |
| API Docs | Scalar (OpenAPI 3.0) |
| Runtime | Bun |
| i18n | next-intl (en + id) |
| Monorepo | Turborepo, Biome |
| Monorepo Packages | @finopenpos/ui, @finopenpos/auth, @finopenpos/db, @finopenpos/api |

## Quick Start

```bash
git clone https://github.com/JoaoHenriqueBarbosa/FinOpenPOS.git
cd FinOpenPOS
cp apps/web/.env.example apps/web/.env
```

Edit `apps/web/.env` with a secure secret:

```
BETTER_AUTH_SECRET=generate-with-openssl-rand-base64-32
BETTER_AUTH_URL=http://localhost:3001
```

```bash
bun install
bun run dev
```

Open http://localhost:3001 and use the **Fill demo credentials** button to sign in with the test account (`test@example.com` / `test1234`).

> The first `bun run dev:web` starts PostgreSQL from `compose.yaml`, pushes the schema via Drizzle and runs the web app. Seed/demo data depends on available setup scripts. Category tables such as `product_categories` and `transaction_categories` start empty and are managed from the UI.

## Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Start all apps via Turborepo |
| `bun run dev:web` | Start only the web app |
| `bun run check` | Lint and format with Biome |
| `cd apps/web && bun test` | Run tRPC router tests |
| `bun run db:push` | Push Drizzle schema to PostgreSQL |

## Project Structure

```
FinOpenPOS/
├── apps/
│   └── web/                    # Next.js 16 web application
│       ├── src/
│       │   ├── app/            # Pages (admin, login, signup, API routes)
│       │   ├── components/     # UI components (shadcn + custom)
│       │   ├── lib/
│       │   │   ├── db/         # Drizzle PostgreSQL connection + schema
│       │   │   └── trpc/       # tRPC routers (business APIs)
│       │   ├── messages/       # i18n (en.ts, id.ts)
│       │   └── proxy.ts        # Next.js 16 middleware
│       ├── scripts/            # DB ensure, ER gen, prepare-prod
├── packages/
│   ├── api/                    # Shared API package
│   ├── auth/                   # Better Auth integration
│   ├── db/                     # Shared Drizzle schema/types
│   └── ui/                     # Shared UI components
├── turbo.json                  # Turborepo task config
├── biome.json                  # Linter/formatter config
├── Dockerfile                  # Dev Docker image
├── Dockerfile.production       # Production (PostgreSQL) Docker image
└── docs/                       # Product, database and roadmap documentation
```

## API

All API procedures require authentication via Better Auth session cookie. The API uses **tRPC** for end-to-end type safety — frontend components consume procedures directly with full TypeScript inference.

### Interactive Docs

Visit **`/api/docs`** for the full interactive API reference powered by Scalar, auto-generated from the tRPC router definitions.

The raw OpenAPI 3.0 spec is available at `/api/openapi.json`.

### tRPC Procedures

| Router | Procedures | Description |
|--------|-----------|-------------|
| `products` | `list`, `create`, `update`, `delete` | Product CRUD with stock, product/service type and categories |
| `productCategories` | `list`, `create` | Product category setup |
| `customers` | `list`, `create`, `update`, `delete` | Customer CRUD with required phone and optional email/address |
| `orders` | `list`, `get`, `create`, `update`, `delete`, `receivePayment` | Order lifecycle, item snapshots and payment tracking |
| `transactions` | `list`, `create`, `update`, `delete` | Income/expense transaction logging |
| `transactionCategories` | `list`, `create` | Income/expense category setup for transactions |
| `paymentMethods` | `list`, `create`, `update`, `delete` | Payment method management |
| `dashboard` | `stats` | Aggregated revenue, expenses, profit, cash flow, margins |
| `companySettings` | `get`, `upsert` | Business profile, locale and address settings |
| `cities` | `listByState` | Indonesian city lookup |

## Testing

Run the web router and app checks from the workspace:

```bash
cd apps/web && bun test
bun run check-types
```

The tRPC router tests use mocked PostgreSQL-compatible DB bindings to verify CRUD, cross-user isolation, validation errors and payment/order flows.

## Docker Deploy

The project includes a multi-stage Alpine-based Dockerfile and Docker Compose with a persistent volume.

```bash
docker compose up -d          # Build and start
docker compose logs -f        # View logs
docker compose down           # Stop
docker compose down -v        # Stop and delete database data
```

The `compose.yaml` expects `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL` environment variables. For local dev, configure `apps/web/.env`. For Docker, create a root `.env` file or pass them via `-e`:

```bash
BETTER_AUTH_SECRET=your-secret-key-at-least-32-chars
BETTER_AUTH_URL=https://your-domain.com
```

### Coolify / PaaS

The project works with Coolify and similar platforms that detect `compose.yaml`. Set the environment variables in the platform UI. The default internal port is `3111` (configurable via `PORT` env).

## Database

### Schema

<!-- ER_START -->

```mermaid
erDiagram
    products {
        serial id PK
        varchar name
        text description
        integer price
        integer cost
        integer in_stock
        boolean track_stock
        integer wholesale_price
        integer wholesale_min_qty
        varchar product_type
        varchar user_uid
        varchar category
        text image_url
        varchar image_key
        integer image_width
        integer image_height
        text image_blurhash
        timestamp image_updated_at
        timestamp created_at
    }

    customers {
        serial id PK
        varchar name
        varchar email
        varchar phone
        text address
        varchar user_uid
        varchar status
        timestamp created_at
    }

    payment_methods {
        serial id PK
        varchar name
        varchar user_uid
        timestamp created_at
    }

    orders {
        serial id PK
        varchar order_number
        varchar client_order_id UK
        integer customer_id FK
        integer total_amount
        text note
        varchar user_uid
        varchar status
        integer paid_amount
        varchar payment_status
        timestamp created_at
    }

    order_items {
        serial id PK
        integer order_id FK
        integer product_id FK
        varchar item_name
        varchar item_type
        integer quantity
        integer price
        integer cost
        text note
        timestamp created_at
    }

    transactions {
        serial id PK
        varchar transaction_number
        text description
        integer order_id FK
        integer service_order_id FK
        integer payment_method_id FK
        integer amount
        varchar user_uid
        varchar type
        varchar category
        varchar status
        timestamp created_at
    }

    customers |o--o{ orders : "has"
    orders |o--o{ order_items : "contains"
    products |o--o{ order_items : "references"
    orders |o--o{ transactions : "generates"
    service_orders |o--o{ transactions : "relates to"
    payment_methods |o--o{ transactions : "uses"
```

<!-- ER_END -->

All monetary values are stored as **integer cents** (e.g., $49.99 = `4999`). This avoids floating-point precision issues. All tables with `user_uid` enforce multi-tenancy.

### PostgreSQL

The app uses PostgreSQL through Drizzle ORM. Local development starts PostgreSQL through `compose.yaml`; production can provide any PostgreSQL-compatible `DATABASE_URL`.

Default local URL:

```bash
DATABASE_URL=postgresql://finopenpos:finopenpos@localhost:15432/finopenpos
```

Push schema:

```bash
bun run db:push
```

### Local-first browser cache

Dexie stores browser-side products, customers, payment methods, draft POS/service data, product images, and sync queue items. The service worker caches app shell routes and asks open windows to flush pending sync work when background sync fires.

Core transactional tables include `created_at`, `updated_at`, and `deleted_at` fields so future sync can compare versions and prefer soft-delete flows over destructive deletes.

## Contributing

Contributions are welcome! Open an issue or submit a Pull Request.

## License

MIT License — see [LICENSE](LICENSE).
