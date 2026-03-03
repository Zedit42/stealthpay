/**
 * Frontend wrapper around SDK stealth crypto functions.
 * Manages key storage in localStorage.
 */

import { ec, hash } from 'starknet';

const { starkCurve } = ec;
const { ProjectivePoint, CURVE } = starkCurve;
const G = ProjectivePoint.BASE;
const N = CURVE.n;

const STORAGE_KEY = 'stealthpay_keys';

export interface StealthKeys {
  spendingKey: string; // hex
  viewingKey: string; // hex
  spendingPubX: string;
  spendingPubY: string;
  viewingPubX: string;
  viewingPubY: string;
}

function randomScalar(): bigint {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let scalar = 0n;
  for (const b of bytes) scalar = (scalar << 8n) | BigInt(b);
  return (scalar % (N - 1n)) + 1n;
}

function toHex(n: bigint): string {
  return '0x' + n.toString(16);
}

export function generateAndStoreKeys(): StealthKeys {
  const sk = randomScalar();
  const vk = randomScalar();
  const S = G.multiply(sk).toAffine();
  const V = G.multiply(vk).toAffine();

  const keys: StealthKeys = {
    spendingKey: toHex(sk),
    viewingKey: toHex(vk),
    spendingPubX: toHex(S.x),
    spendingPubY: toHex(S.y),
    viewingPubX: toHex(V.x),
    viewingPubY: toHex(V.y),
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
  return keys;
}

export function getStoredKeys(): StealthKeys | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  return JSON.parse(raw);
}

export function clearKeys(): void {
  localStorage.removeItem(STORAGE_KEY);
}

function poseidonHash2(a: bigint, b: bigint): bigint {
  return BigInt(hash.computePoseidonHash(toHex(a), toHex(b)));
}

/**
 * Sender: derive stealth address from receiver's meta-address
 */
export function deriveStealthAddress(
  spendingPubX: bigint, spendingPubY: bigint,
  viewingPubX: bigint, viewingPubY: bigint,
) {
  const r = randomScalar();
  const R = G.multiply(r).toAffine();

  const V = ProjectivePoint.fromAffine({ x: viewingPubX, y: viewingPubY });
  const sharedSecret = V.multiply(r).toAffine();

  const h = poseidonHash2(sharedSecret.x, sharedSecret.y) % N;
  const hG = G.multiply(h);

  const S = ProjectivePoint.fromAffine({ x: spendingPubX, y: spendingPubY });
  const stealthPub = S.add(hG).toAffine();

  return {
    stealthPubX: toHex(stealthPub.x),
    stealthPubY: toHex(stealthPub.y),
    ephemeralPubX: toHex(R.x),
    ephemeralPubY: toHex(R.y),
  };
}

/**
 * Receiver: scan ephemeral keys to find payments
 */
export function scanForPayments(
  viewingKey: bigint,
  spendingPubX: bigint, spendingPubY: bigint,
  payments: Array<{ ephPubX: bigint; ephPubY: bigint; stealthX: bigint; stealthY: bigint }>,
): number[] {
  const matches: number[] = [];
  const S = ProjectivePoint.fromAffine({ x: spendingPubX, y: spendingPubY });

  for (let i = 0; i < payments.length; i++) {
    const p = payments[i];
    const R = ProjectivePoint.fromAffine({ x: p.ephPubX, y: p.ephPubY });
    const sharedSecret = R.multiply(viewingKey).toAffine();
    const h = poseidonHash2(sharedSecret.x, sharedSecret.y) % N;
    const hG = G.multiply(h);
    const expected = S.add(hG).toAffine();

    if (expected.x === p.stealthX && expected.y === p.stealthY) {
      matches.push(i);
    }
  }
  return matches;
}

/**
 * Compute stealth private key for withdrawal
 */
export function computeStealthPrivateKey(
  spendingKey: bigint, viewingKey: bigint,
  ephPubX: bigint, ephPubY: bigint,
): bigint {
  const R = ProjectivePoint.fromAffine({ x: ephPubX, y: ephPubY });
  const sharedSecret = R.multiply(viewingKey).toAffine();
  const h = poseidonHash2(sharedSecret.x, sharedSecret.y) % N;
  return (spendingKey + h) % N;
}

/**
 * Sign a withdrawal request
 */
export function signWithdrawal(
  stealthPrivKey: bigint,
  stealthPubX: bigint, stealthPubY: bigint,
  token: string, recipient: string,
  amount: bigint, nonce: bigint,
) {
  const amountLow = amount & ((1n << 128n) - 1n);
  const amountHigh = amount >> 128n;

  const msgHash = BigInt(hash.computePoseidonHashOnElements([
    toHex(stealthPubX), toHex(stealthPubY),
    token, recipient,
    toHex(amountLow), toHex(amountHigh),
    toHex(nonce),
  ]));

  const sig = starkCurve.sign(toHex(msgHash), toHex(stealthPrivKey));

  return {
    msgHash: toHex(msgHash),
    sigR: toHex(sig.r),
    sigS: toHex(sig.s),
  };
}

/**
 * Sign a split withdrawal (up to 3 recipients)
 */
export function signSplitWithdrawal(
  stealthPrivKey: bigint,
  stealthPubX: bigint, stealthPubY: bigint,
  token: string,
  recipients: { address: string; amount: bigint }[],
  nonce: bigint,
) {
  const numRecipients = recipients.length;
  const r1 = recipients[0]?.address || '0x0';
  const a1 = recipients[0]?.amount || 0n;
  const r2 = recipients[1]?.address || '0x0';
  const a2 = recipients[1]?.amount || 0n;
  const r3 = recipients[2]?.address || '0x0';
  const a3 = recipients[2]?.amount || 0n;

  const msgHash = BigInt(hash.computePoseidonHashOnElements([
    toHex(stealthPubX), toHex(stealthPubY),
    token,
    r1, toHex(a1 & ((1n << 128n) - 1n)), toHex(a1 >> 128n),
    r2, toHex(a2 & ((1n << 128n) - 1n)), toHex(a2 >> 128n),
    r3, toHex(a3 & ((1n << 128n) - 1n)), toHex(a3 >> 128n),
    toHex(BigInt(numRecipients)),
    toHex(nonce),
  ]));

  const sig = starkCurve.sign(toHex(msgHash), toHex(stealthPrivKey));

  return {
    msgHash: toHex(msgHash),
    sigR: toHex(sig.r),
    sigS: toHex(sig.s),
  };
}

export function generateNonce(): bigint {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let nonce = 0n;
  for (const b of bytes) nonce = (nonce << 8n) | BigInt(b);
  return nonce;
}
