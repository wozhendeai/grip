# BountyLane

Open source bounties on Tempo blockchain. Fund GitHub issues, pay contributors instantly with passkeys.

**Spec**: See `spec.md` for complete technical specification. Detailed docs in `docs/` folder:
- `database-schema.md` - PostgreSQL schema with Drizzle
- `api-routes.md` - All API endpoints
- `tempo-integration.md` - Tempo plugin + blockchain patterns
- `implementation.md` - Build order + demo script
- `user-flows.md` - User journeys
- `frontend-pages.md` - Page structure

**Tempo Docs**: Use the `tempo-protocol` skill for blockchain documentation.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS + shadcn/ui |
| Database | PostgreSQL + Drizzle ORM |
| Auth | better-auth (GitHub OAuth + Passkey + Tempo plugin) |
| Blockchain | Tempo SDK + viem |
| GitHub | Octokit + Webhooks |
| Package Manager | pnpm |

## Commands

```bash
pnpm dev           # Start dev server
pnpm build         # Production build
pnpm tsc --noEmit  # Type check (run before commits)
pnpm lint          # Lint with Biome
pnpm format        # Format with Biome

# Database
pnpm db:generate   # Generate Drizzle migrations
pnpm db:migrate    # Run migrations
pnpm db:studio     # Open Drizzle Studio
```

## Auth Architecture

BountyLane uses **better-auth** with a custom **tempo plugin**. The passkey IS the wallet — no separate wallets table.

```typescript
// lib/auth.ts
export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg' }),
  socialProviders: { github: {...} },
  plugins: [
    passkey(),   // WebAuthn credentials
    tempo(),     // Extends passkey with tempoAddress field
  ],
});
```

**Flow:**
1. GitHub OAuth → identity
2. Passkey creation → WebAuthn credential + tempoAddress derived from P256 public key
3. Single `passkey` table stores auth credential AND blockchain address

## Tempo Blockchain Gotchas

**CRITICAL - Tempo has no native token:**
- `eth_getBalance` returns a huge placeholder number (NOT real balance)
- `address.balance` returns 0 in Solidity
- ALWAYS use `TIP20.balanceOf(address)` for balance checks
- Fees are paid in any USD-denominated TIP-20 token

**Network (Moderato Testnet):**
- Chain ID: 42431
- RPC: https://rpc.moderato.tempo.xyz
- Explorer: https://explore.tempo.xyz

**Key Tempo features used:**
- Passkey auth (WebAuthn/P256) for wallet creation
- TIP-20 transfers with memos for bounty payouts
- Transfer commitments for work receipt hashing
- Batched payments for weekly payout runs
- Fee sponsorship for gasless contributor UX

## File Organization

Feature-based, not type-based:

```
app/
├── api/
│   ├── auth/[...all]/       # better-auth handler
│   ├── bounties/
│   ├── projects/
│   └── webhooks/github/
├── (main)/
│   ├── layout.tsx           # Has modal slot
│   ├── explore/
│   ├── dashboard/
│   ├── wallet/
│   ├── u/[username]/page.tsx        # User profile (full page)
│   ├── tx/[hash]/page.tsx           # Transaction (full page)
│   ├── [owner]/[repo]/
│   │   └── bounties/[id]/page.tsx   # Bounty detail (full page)
│   │
│   └── @modal/                      # Parallel route for modals
│       ├── default.tsx              # Returns null
│       ├── (.)u/[username]/page.tsx        # Intercepts → modal
│       ├── (.)tx/[hash]/page.tsx           # Intercepts → modal
│       └── (.)[owner]/[repo]/bounties/[id]/page.tsx
├── components/
│   └── ui/                  # Global primitives ONLY (used in 2+ features)
└── lib/
    ├── auth.ts              # better-auth server
    ├── auth-client.ts       # better-auth client
    ├── tempo-plugin.ts      # Tempo address derivation
    └── tempo/               # Blockchain utilities
```

## Parallel Routes + Intercepting Routes (Modals)

Instagram-style modals: click opens modal with URL change, direct URL loads full page.

**Layout with modal slot:**
```tsx
// app/(main)/layout.tsx
export default function Layout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  return (
    <>
      {children}
      {modal}
    </>
  );
}
```

**Default slot (required):**
```tsx
// app/(main)/@modal/default.tsx
export default function Default() {
  return null;
}
```

**Intercepting route renders modal:**
```tsx
// app/(main)/@modal/(.)u/[username]/page.tsx
import { RouteModal } from '@/components/modal/RouteModal';
import { UserProfile } from '../../u/[username]/_components/UserProfile';

export default function UserModal({ params }: { params: { username: string } }) {
  return (
    <RouteModal>
      <UserProfile username={params.username} />
    </RouteModal>
  );
}
```

**Interception prefixes:**
- `(.)` - same level
- `(..)` - one level up
- `(...)` - from app root

- Prefix with `_` for route-private directories
- Only move to global `components/` if used in 2+ features
- Colocate related code with the route that uses it

## Code Standards

- **NO `any` types** - Use proper typing or `unknown` with type guards
- **Prefer editing existing files** over creating new ones
- **Check spec.md and docs/** before implementing any feature
- **Use tempo-protocol skill** when unsure about Tempo APIs
- **Test passkey flows in Chrome** (best WebAuthn support)
- **All user IDs are TEXT** (better-auth uses string IDs, not UUIDs)