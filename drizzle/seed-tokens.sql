-- Seed tokens for testnet and mainnet
-- Run this after migrations to populate the tokens allowlist

-- Testnet tokens (fake stablecoins for testing)
INSERT INTO tokens (address, network, symbol, name, decimals, is_active) VALUES
  ('0x20c0000000000000000000000000000000000001', 'testnet', 'AlphaUSD', 'Alpha USD', 6, true),
  ('0x20c0000000000000000000000000000000000002', 'testnet', 'BetaUSD', 'Beta USD', 6, true),
  ('0x20c0000000000000000000000000000000000003', 'testnet', 'ThetaUSD', 'Theta USD', 6, true)
ON CONFLICT (address, network) DO NOTHING;

-- Mainnet tokens (to be added when addresses are available)
-- INSERT INTO tokens (address, network, symbol, name, decimals, is_active) VALUES
--   ('0x...', 'mainnet', 'USDC', 'USD Coin', 6, true)
-- ON CONFLICT (address, network) DO NOTHING;
