/**
 * StealthPay SDK — Stealth Address Cryptography
 *
 * Uses Starknet's native Stark curve via starknet.js
 * Adapted from EIP-5564 stealth address scheme.
 */

import { ec, hash } from 'starknet';

const { starkCurve } = ec;
const { ProjectivePoint, CURVE } = starkCurve;

type Point = InstanceType<typeof ProjectivePoint>;

const G = ProjectivePoint.BASE;
const N = CURVE.n;

export interface KeyPair {
  privateKey: bigint;
  publicKey: { x: bigint; y: bigint };
}

export interface MetaAddress {
  spendingPubKey: { x: bigint; y: bigint };
  viewingPubKey: { x: bigint; y: bigint };
}

export interface StealthResult {
  stealthPubKey: { x: bigint; y: bigint };
  ephemeralPubKey: { x: bigint; y: bigint };
}

// ─── Internals ───

function randomScalar(): bigint {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let scalar = 0n;
  for (const b of bytes) {
    scalar = (scalar << 8n) | BigInt(b);
  }
  return (scalar % (N - 1n)) + 1n;
}

function toAffine(p: Point): { x: bigint; y: bigint } {
  const a = p.toAffine();
  return { x: a.x, y: a.y };
}

function fromAffine(p: { x: bigint; y: bigint }): Point {
  return ProjectivePoint.fromAffine(p);
}

function poseidonHash2(a: bigint, b: bigint): bigint {
  return BigInt(
    hash.computePoseidonHash('0x' + a.toString(16), '0x' + b.toString(16)),
  );
}

// ─── Public API ───

export function generateKeyPair(): KeyPair {
  const privateKey = randomScalar();
  const publicKey = toAffine(G.multiply(privateKey));
  return { privateKey, publicKey };
}

export function generateKeys(): {
  spendingKey: bigint;
  viewingKey: bigint;
  metaAddress: MetaAddress;
} {
  const spending = generateKeyPair();
  const viewing = generateKeyPair();
  return {
    spendingKey: spending.privateKey,
    viewingKey: viewing.privateKey,
    metaAddress: {
      spendingPubKey: spending.publicKey,
      viewingPubKey: viewing.publicKey,
    },
  };
}

export function encodeMetaAddress(meta: MetaAddress): string {
  const sx = meta.spendingPubKey.x.toString(16).padStart(64, '0');
  const sy = meta.spendingPubKey.y.toString(16).padStart(64, '0');
  const vx = meta.viewingPubKey.x.toString(16).padStart(64, '0');
  const vy = meta.viewingPubKey.y.toString(16).padStart(64, '0');
  return `0x${sx}${sy}${vx}${vy}`;
}

export function decodeMetaAddress(encoded: string): MetaAddress {
  const hex = encoded.startsWith('0x') ? encoded.slice(2) : encoded;
  return {
    spendingPubKey: {
      x: BigInt('0x' + hex.slice(0, 64)),
      y: BigInt('0x' + hex.slice(64, 128)),
    },
    viewingPubKey: {
      x: BigInt('0x' + hex.slice(128, 192)),
      y: BigInt('0x' + hex.slice(192, 256)),
    },
  };
}

/**
 * Sender: derive a stealth address from a receiver's meta-address
 */
export function deriveStealthAddress(metaAddress: MetaAddress): StealthResult {
  const r = randomScalar();
  const R = toAffine(G.multiply(r)); // ephemeral pub key

  // shared_secret = r * V
  const sharedSecret = toAffine(fromAffine(metaAddress.viewingPubKey).multiply(r));

  // h = poseidon(shared_secret.x, shared_secret.y) mod N
  const h = poseidonHash2(sharedSecret.x, sharedSecret.y) % N;

  // stealth_pub = S + h*G
  const hG = G.multiply(h);
  const stealthPubKey = toAffine(fromAffine(metaAddress.spendingPubKey).add(hG));

  return { stealthPubKey, ephemeralPubKey: R };
}

/**
 * Receiver: scan ephemeral keys to detect payments
 */
export function scanPayments(
  viewingKey: bigint,
  spendingPubKey: { x: bigint; y: bigint },
  ephemeralPubKeys: { x: bigint; y: bigint }[],
  stealthAddresses: { x: bigint; y: bigint }[],
): number[] {
  const matches: number[] = [];

  for (let i = 0; i < ephemeralPubKeys.length; i++) {
    // shared_secret = v * R
    const sharedSecret = toAffine(fromAffine(ephemeralPubKeys[i]).multiply(viewingKey));
    const h = poseidonHash2(sharedSecret.x, sharedSecret.y) % N;

    // expected = S + h*G
    const hG = G.multiply(h);
    const expected = toAffine(fromAffine(spendingPubKey).add(hG));

    if (expected.x === stealthAddresses[i].x && expected.y === stealthAddresses[i].y) {
      matches.push(i);
    }
  }

  return matches;
}

/**
 * Receiver: compute private key for a stealth address
 */
export function computeStealthPrivateKey(
  spendingKey: bigint,
  viewingKey: bigint,
  ephemeralPubKey: { x: bigint; y: bigint },
): bigint {
  const sharedSecret = toAffine(fromAffine(ephemeralPubKey).multiply(viewingKey));
  const h = poseidonHash2(sharedSecret.x, sharedSecret.y) % N;
  return (spendingKey + h) % N;
}
