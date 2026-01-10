# Changelog

All notable changes to the Tempo better-auth plugin.

## [0.0.0] - 2025-01-10

Initially Stable.

### Features

- **Passkey authentication** - WebAuthn registration and authentication endpoints
- **Tempo address derivation** - Automatic P256 public key → Tempo address (keccak256)
- **Wallet management** - Support for passkey, server, and external wallets
- **Access Keys** - Delegated signing authorization with spending limits and expiry
- **wagmi KeyManager** - `createTempoKeyManager()` for wagmi WebAuthn connector integration
- **Reactive state** - Nanostores atoms for passkeys and access keys

### Endpoints

- `GET /tempo/passkeys` - List passkeys with `publicKeyHex` and `tempoAddress`
- `GET /tempo/passkey/register-options` - WebAuthn registration challenge
- `POST /tempo/passkey/register` - Verify registration, create passkey + wallet
- `GET /tempo/passkey/authenticate-options` - WebAuthn authentication challenge
- `POST /tempo/passkey/authenticate` - Authenticate and create session
- `DELETE /tempo/passkey/:credentialId` - Delete passkey
- `GET /tempo/wallets` - List wallets
- `GET /tempo/wallets/:idOrAddress` - Get wallet
- `POST /tempo/wallets` - Create external wallet
- `GET /tempo/server-wallet` - Get server wallet
- `GET /tempo/access-keys` - List access keys
- `POST /tempo/access-keys` - Create access key
- `GET /tempo/access-keys/:id` - Get access key
- `DELETE /tempo/access-keys/:id` - Revoke access key

### Client Actions

- `registerPasskey({ name })` - Full WebAuthn ceremony + wallet creation
- `authenticateWithPasskey()` - Passkey authentication
- `listTempoPasskeys()` - List passkeys with addresses
- `deletePasskey(credentialId)` - Delete passkey
- `signKeyAuthorization({ config, chainId, keyType, address, limits })` - Sign access key authorization
- `createAccessKey(...)` - Create access key from signed authorization
- `listAccessKeys()` / `getAccessKey()` / `revokeAccessKey()` - Access key management
- `listWallets()` / `getWallet()` / `getPasskeyWallet()` / `getServerWallet()` - Wallet queries
- `verifyPasskeyRegistrationRaw()` - Low-level registration for wagmi KeyManager

### Configuration

- `passkey.rpID` / `rpName` / `origin` - WebAuthn relying party config
- `passkey.challengeMaxAge` - Challenge expiration (default: 300s)
- `serverWallet` - Static or dynamic server wallet configuration
- `allowedChainIds` - Whitelist for access key chain IDs
- `schema` - Schema extensions for custom fields
