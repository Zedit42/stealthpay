import { describe, it, expect } from 'vitest';
import {
  generateKeys,
  deriveStealthAddress,
  scanPayments,
  computeStealthPrivateKey,
  encodeMetaAddress,
  decodeMetaAddress,
} from './stealth.js';
import { ec } from 'starknet';

const { starkCurve } = ec;
const G = starkCurve.ProjectivePoint.BASE;

describe('Stealth Address Crypto', () => {
  it('should generate valid keys', () => {
    const keys = generateKeys();
    expect(keys.spendingKey).toBeGreaterThan(0n);
    expect(keys.viewingKey).toBeGreaterThan(0n);
    expect(keys.metaAddress.spendingPubKey.x).toBeGreaterThan(0n);
    expect(keys.metaAddress.viewingPubKey.x).toBeGreaterThan(0n);
  });

  it('should encode and decode meta-address', () => {
    const keys = generateKeys();
    const encoded = encodeMetaAddress(keys.metaAddress);
    const decoded = decodeMetaAddress(encoded);
    expect(decoded.spendingPubKey.x).toBe(keys.metaAddress.spendingPubKey.x);
    expect(decoded.spendingPubKey.y).toBe(keys.metaAddress.spendingPubKey.y);
    expect(decoded.viewingPubKey.x).toBe(keys.metaAddress.viewingPubKey.x);
    expect(decoded.viewingPubKey.y).toBe(keys.metaAddress.viewingPubKey.y);
  });

  it('should derive stealth address and receiver should detect it', () => {
    const receiver = generateKeys();
    const { stealthPubKey, ephemeralPubKey } = deriveStealthAddress(receiver.metaAddress);

    const matches = scanPayments(
      receiver.viewingKey,
      receiver.metaAddress.spendingPubKey,
      [ephemeralPubKey],
      [stealthPubKey],
    );
    expect(matches).toEqual([0]);
  });

  it('should NOT match payments for a different receiver', () => {
    const receiver = generateKeys();
    const other = generateKeys();

    const { stealthPubKey, ephemeralPubKey } = deriveStealthAddress(receiver.metaAddress);

    const matches = scanPayments(
      other.viewingKey,
      other.metaAddress.spendingPubKey,
      [ephemeralPubKey],
      [stealthPubKey],
    );
    expect(matches).toEqual([]);
  });

  it('should compute valid stealth private key', () => {
    const receiver = generateKeys();
    const { stealthPubKey, ephemeralPubKey } = deriveStealthAddress(receiver.metaAddress);

    const stealthPrivKey = computeStealthPrivateKey(
      receiver.spendingKey,
      receiver.viewingKey,
      ephemeralPubKey,
    );

    // Verify: stealthPrivKey * G === stealthPubKey
    const derivedPub = G.multiply(stealthPrivKey).toAffine();
    expect(derivedPub.x).toBe(stealthPubKey.x);
    expect(derivedPub.y).toBe(stealthPubKey.y);
  });

  it('should handle multiple payments and find correct ones', () => {
    const receiver = generateKeys();
    const other = generateKeys();

    const p0 = deriveStealthAddress(receiver.metaAddress);
    const p1 = deriveStealthAddress(other.metaAddress);
    const p2 = deriveStealthAddress(receiver.metaAddress);

    const matches = scanPayments(
      receiver.viewingKey,
      receiver.metaAddress.spendingPubKey,
      [p0.ephemeralPubKey, p1.ephemeralPubKey, p2.ephemeralPubKey],
      [p0.stealthPubKey, p1.stealthPubKey, p2.stealthPubKey],
    );
    expect(matches).toEqual([0, 2]);
  });
});
