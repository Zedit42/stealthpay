# StealthPay — Phase 1: Project Scaffold + Stealth Address Crypto

## What to Build
A Starknet-based stealth payment protocol. This phase: set up the full monorepo and implement stealth address cryptography.

## Project Structure
```
stealthpay/
├── contracts/          # Cairo smart contracts (Scarb workspace)
│   ├── src/
│   │   ├── lib.cairo
│   │   ├── registry.cairo      # Meta-address registry
│   │   ├── stealth_vault.cairo # Payment vault (receives funds)
│   │   └── withdrawal.cairo    # ZK withdrawal with proof
│   ├── tests/
│   │   └── test_registry.cairo
│   └── Scarb.toml
├── frontend/           # React + Vite + starknet.js
│   ├── src/
│   │   ├── App.tsx
│   │   ├── crypto/
│   │   │   └── stealth.ts      # Stealth address derivation
│   │   ├── components/
│   │   └── hooks/
│   ├── package.json
│   └── vite.config.ts
├── sdk/                # TypeScript SDK
│   ├── src/
│   │   ├── index.ts
│   │   └── stealth.ts
│   └── package.json
└── README.md
```

## Phase 1 Tasks

### 1. Scarb Project Setup
- Run `scarb init` in contracts/
- Add OpenZeppelin Cairo contracts dependency in Scarb.toml
- Add snforge test runner config
- Create the module files (registry, stealth_vault, withdrawal) with placeholder structs

### 2. Frontend Scaffold
- Vite + React + TypeScript
- Install: starknet.js, get-starknet, @noble/curves, @noble/hashes
- Basic App.tsx with wallet connect button (Argent X / Braavos)
- Routing: /pay/:address, /scan, /dashboard

### 3. Stealth Address Cryptography (SDK + Frontend)
This is the CORE of Phase 1. Implement in sdk/src/stealth.ts:

**EIP-5564 Stealth Address Scheme (adapted for Starknet's curve):**

Starknet uses the Stark curve (not secp256k1). So we adapt:

a) **Key Generation:**
   - User generates: spending_key (s), viewing_key (v) — both scalars on Stark curve
   - Meta-address = (S, V) where S = s*G, V = v*G (public keys)

b) **Sending (stealth address derivation):**
   - Sender generates ephemeral key r (random scalar)
   - Compute shared_secret = r * V (ECDH with viewing public key)
   - Compute stealth_pubkey = S + hash(shared_secret) * G
   - Compute stealth_address = stark_address_from_pubkey(stealth_pubkey)
   - Publish: (R = r*G, stealth_address) — R is the ephemeral public key

c) **Receiving (scanning):**
   - Receiver has viewing_key (v), sees R on-chain
   - Compute shared_secret = v * R (same ECDH result)
   - Compute expected_stealth_pubkey = S + hash(shared_secret) * G
   - If matches → "this payment is for me"
   - Can spend with: stealth_private_key = s + hash(shared_secret)

**Use @noble/curves for Stark curve operations.**
The stark curve is available in @noble/curves/stark.

Implement and export:
- `generateKeys()` → { spendingKey, viewingKey, spendingPubKey, viewingPubKey }
- `generateMetaAddress(spendingPubKey, viewingPubKey)` → string
- `deriveStealthAddress(metaAddress)` → { stealthAddress, ephemeralPubKey }
- `scanPayments(viewingKey, spendingPubKey, ephemeralPubKeys[])` → matching indexes
- `computeStealthPrivateKey(spendingKey, viewingKey, ephemeralPubKey)` → private key

### 4. Cairo Contracts — Scaffolds
Registry contract with:
```cairo
#[starknet::interface]
trait IRegistry<TContractState> {
    fn register(ref self: TContractState, spending_pub_x: felt252, spending_pub_y: felt252, viewing_pub_x: felt252, viewing_pub_y: felt252);
    fn get_meta_address(self: @TContractState, user: ContractAddress) -> (felt252, felt252, felt252, felt252);
}
```

Stealth Vault with:
```cairo
#[starknet::interface]  
trait IStealth<TContractState> {
    fn send(ref self: TContractState, stealth_address: ContractAddress, ephemeral_pub_x: felt252, ephemeral_pub_y: felt252, token: ContractAddress, amount: u256);
}
```

### 5. Tests
- SDK: Jest tests for key generation, stealth address derivation, scanning
- Contracts: snforge tests for registry register/get

## Important Notes
- Use Stark curve (NOT secp256k1) — this is Starknet native
- @noble/curves has stark curve support
- Pedersen hash is native to Starknet, use it for shared_secret hashing
- Keep contracts simple for now — full ZK withdrawal logic comes in Phase 3
- Make sure `scarb build` and `snforge test` pass
- Make sure frontend `npm run dev` works with wallet connect
