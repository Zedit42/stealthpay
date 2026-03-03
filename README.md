# 🥷 StealthPay — Private Payment Links for Starknet

Generate one-time stealth addresses so anyone can receive payments on Starknet without revealing their main wallet.

## Architecture

```
Sender → derives stealth address → sends to one-time address
Receiver → scans chain with viewing key → withdraws to any wallet via ZK proof
```

## Tech Stack

- **Contracts:** Cairo 2.16 (Starknet)
- **Crypto:** Stark curve ECDH + Poseidon hash stealth address scheme
- **Frontend:** React + Vite + starknet.js
- **SDK:** TypeScript SDK for stealth address operations

## Project Structure

```
contracts/     Cairo smart contracts (Registry, Vault, Withdrawal)
sdk/           TypeScript SDK (@stealthpay/sdk)
frontend/      React dApp
```

## Quick Start

```bash
# Build contracts
cd contracts && scarb build

# Run SDK tests
cd sdk && npm install && npx vitest run

# Run frontend
cd frontend && npm install && npm run dev
```

## How It Works

1. **Receiver** generates spending + viewing keys, registers meta-address on-chain
2. **Sender** fetches meta-address, derives a unique stealth address via ECDH
3. **Sender** sends funds to stealth address, publishes ephemeral key
4. **Receiver** scans ephemeral keys with viewing key, finds their payments
5. **Receiver** computes stealth private key, withdraws to any wallet

No mixer. No pool. No waiting. Per-payment privacy with instant finality.

## License

MIT
