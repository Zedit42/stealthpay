<p align="center">
  <h1 align="center">🥷 StealthPay</h1>
  <p align="center"><strong>Private Payments on Starknet</strong></p>
  <p align="center">
    Receive payments without revealing your wallet address.<br/>
    Powered by stealth addresses and STARK cryptography.
  </p>
  <p align="center">
    <a href="https://stealthpay-app.vercel.app"><strong>🔗 Live Demo</strong></a> ·
    <a href="https://sepolia.voyager.online/contract/0x07efc6272b3b1db522e63c114ef07d52cd1c0902d1102d3d0b5118c9a30c83d2"><strong>📜 Contract on Voyager</strong></a>
  </p>
  <p align="center">
    <img src="https://img.shields.io/badge/Starknet-Sepolia-blue?style=flat-square" />
    <img src="https://img.shields.io/badge/Cairo-2.16-orange?style=flat-square" />
    <img src="https://img.shields.io/badge/Tests-20%2F20-brightgreen?style=flat-square" />
    <img src="https://img.shields.io/badge/License-MIT-lightgrey?style=flat-square" />
  </p>
</p>

---

## 🎯 Problem

Every transaction on Starknet is fully transparent. When someone pays you, the world sees who sent it, who received it, and how much. Your wallet becomes a public financial ledger — no privacy, no fungibility.

## 💡 Solution

StealthPay implements **stealth addresses** ([EIP-5564](https://eips.ethereum.org/EIPS/eip-5564)) natively on Starknet using the Stark curve. Each payment generates a unique one-time address that is cryptographically unlinkable to the receiver.

```
                    Payment Link
    Receiver ─────────────────────▶ Sender
                                      │
                                      │ derives stealth address
                                      ▼
    ┌──────────────────────────────────────┐
    │          StealthVault Contract        │
    │                                      │
    │   Sender → 0xOneTimeAddr (stealth)   │
    │                 ❓                    │
    │   Nobody knows who owns this addr    │
    └──────────────────────────────────────┘
                                      │
                    scan with         │ withdraw with
                    viewing key       │ spending key
                                      ▼
                                  Receiver
                              (any wallet)
```

**Result:** No on-chain link between sender and receiver. Ever.

---

## ✨ Features

### 🔐 Core Privacy
| Feature | Description |
|---------|-------------|
| **Stealth Addresses** | One-time addresses per payment via Stark curve ECDH + Poseidon hash |
| **Dual Key System** | Separate viewing key (detect payments) and spending key (withdraw funds) |
| **ECDSA Withdrawal** | Signature-based withdrawal — prove ownership without revealing the stealth private key |

### 🛡️ Privacy Enhancements
| Feature | Description |
|---------|-------------|
| **🔄 Relayer Pattern** | Anyone can submit your withdrawal tx. Your wallet never appears as the caller — only the stealth key signs. |
| **✂️ Split Withdrawal** | Withdraw to up to 3 different addresses in one tx. Breaks amount-based correlation. |
| **🧠 Client-side Scanning** | Viewing key never leaves your browser. All payment detection is 100% local. |

### 🧑‍💻 Developer Experience
| Feature | Description |
|---------|-------------|
| **TypeScript SDK** | Full stealth crypto, signing, scanning — drop into any project |
| **20+ Tests** | 9 Cairo (snforge) + 11 SDK (vitest) — all passing |
| **React Frontend** | Complete UI with Argent X / Braavos wallet integration |

---

## 🔒 Privacy Model

### What an observer sees on-chain:

```
Tx 1:  Ali (sender)  →  StealthVault  →  0xA7f3...  (unknown)
Tx 2:  0xA7f3...     →  0x1234...  (wallet A)
                      →  0x5678...  (wallet B)
                      →  0x9abc...  (wallet C)
```

### What they **cannot** determine:
- ❌ Who owns `0xA7f3...` (the stealth address)
- ❌ That wallets A, B, C belong to the same person
- ❌ Any link between Ali and the actual receiver
- ❌ Which deposit corresponds to which withdrawal

### Cryptographic guarantees:
- **ECDH shared secret** on Stark curve — computationally infeasible to reverse
- **Poseidon hashing** — on-chain data reveals nothing about the shared secret
- **One-time addresses** — no pattern across payments
- **Split withdrawals** — defeat amount-based heuristics

---

## 🏗️ Architecture

```
stealthpay/
├── contracts/                    # Cairo smart contracts
│   ├── src/
│   │   ├── stealth_vault.cairo   # Vault: deposit, withdraw, split
│   │   ├── registry.cairo        # On-chain meta-address registry
│   │   └── mock_erc20.cairo      # Test ERC20 token
│   └── tests/                    # 9 snforge tests
│
├── sdk/                          # TypeScript SDK
│   └── src/
│       ├── stealth.ts            # Key gen, derive, scan, compute
│       ├── withdrawal.ts         # Signing & verification
│       └── *.test.ts             # 11 vitest tests
│
└── frontend/                     # React + Vite + TypeScript
    └── src/
        ├── crypto/stealth.ts     # Client-side stealth crypto
        ├── pages/                # Home, Pay, Scan, Dashboard
        └── hooks/useStealthKeys  # localStorage key management
```

---

## 🚀 Quick Start

### Prerequisites
- [Scarb](https://docs.swmansion.com/scarb/) ≥ 2.16.0
- [Starknet Foundry](https://foundry-rs.github.io/starknet-foundry/) ≥ 0.57.0
- Node.js ≥ 18

### Build & Test Contracts

```bash
cd contracts
scarb build        # Compile Cairo contracts
snforge test       # Run 9 contract tests
```

### Build & Test SDK

```bash
cd sdk
npm install
npm test           # Run 11 SDK tests
```

### Run Frontend Locally

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
```

---

## 🔗 Deployed Contracts (Starknet Sepolia)

| Contract | Address | Explorer |
|----------|---------|----------|
| **StealthVault** | `0x07efc...83d2` | [View on Voyager ↗](https://sepolia.voyager.online/contract/0x07efc6272b3b1db522e63c114ef07d52cd1c0902d1102d3d0b5118c9a30c83d2) |
| **Registry** | `0x03dbb...1deb` | [View on Voyager ↗](https://sepolia.voyager.online/contract/0x03dbbf448900141c36d85ff6b94e9891616e57f19e82d37cd7def23b1cf21deb) |

---

## 🧪 End-to-End Test

Tested on Starknet Sepolia with real STRK tokens — full payment cycle verified:

```
🥷 StealthPay V2 E2E Test

💸 Deposit 0.0003 STRK to stealth address          ✅
🔄 Relayer pattern withdraw (anyone submits tx)     ✅
✂️  Split withdrawal to 3 different addresses        ✅
🔎 Receiver scan detects payment with viewing key   ✅
📊 Vault balance returns to 0 after withdrawal      ✅

🎉 ALL TESTS PASSED — Full stealth payment cycle works!
```

---

## 📖 How It Works (Step by Step)

### 1. Generate Keys
Receiver creates a **spending key** and **viewing key** in the browser. Keys are stored locally — never sent anywhere.

### 2. Share Payment Link
The receiver's public keys are encoded into a URL-safe payment link that can be shared with anyone.

### 3. Send Payment
Sender opens the link, connects their wallet, and sends tokens. The SDK derives a **unique stealth address** using ECDH — the sender doesn't know (and can't learn) the receiver's real address.

### 4. Scan for Payments
Receiver uses their viewing key to scan on-chain events and detect payments meant for them. This is done entirely client-side.

### 5. Withdraw
Receiver computes the stealth private key and signs a withdrawal. They can:
- **Normal withdraw** — send to one address
- **Split withdraw** — distribute across up to 3 addresses for enhanced privacy
- **Use a relayer** — have someone else submit the tx so their wallet never appears on-chain

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| Smart Contracts | Cairo 2.16, OpenZeppelin |
| Cryptography | Stark curve ECDH, Poseidon hash, ECDSA |
| SDK | TypeScript, starknet.js |
| Frontend | React 19, Vite, TypeScript |
| Testing | Starknet Foundry (snforge), Vitest |
| Deployment | Vercel (frontend), Starknet Sepolia (contracts) |

---

## 🗺️ Roadmap

- [x] Stealth address generation & derivation
- [x] On-chain vault with ERC20 support
- [x] ECDSA signature-based withdrawal
- [x] Relayer pattern (gas abstraction)
- [x] Split withdrawal (multi-recipient)
- [x] Full E2E test on Sepolia testnet
- [x] React frontend with wallet integration
- [ ] Multi-token support (USDC, custom ERC20)
- [ ] Relayer service (automated gas sponsorship)
- [ ] Mainnet deployment
- [ ] Mobile-friendly UI

---

## 📜 License

MIT

---

<p align="center">
  Built for the <strong>Starknet Hackathon</strong> 🏗️
</p>
