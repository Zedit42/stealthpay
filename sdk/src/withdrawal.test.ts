import { describe, it, expect } from 'vitest';
import { generateKeys, deriveStealthAddress, computeStealthPrivateKey } from './stealth.js';
import {
  signWithdrawal,
  verifyWithdrawalSignature,
  hashWithdrawalRequest,
  generateNonce,
} from './withdrawal.js';

describe('Withdrawal Signing', () => {
  const TOKEN = '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7'; // ETH on Starknet
  const RECIPIENT = '0x0123456789abcdef0123456789abcdef01234567';

  it('should sign and verify withdrawal', () => {
    const receiver = generateKeys();
    const { stealthPubKey, ephemeralPubKey } = deriveStealthAddress(receiver.metaAddress);
    const stealthPrivKey = computeStealthPrivateKey(
      receiver.spendingKey,
      receiver.viewingKey,
      ephemeralPubKey,
    );

    const params = {
      stealthPubX: stealthPubKey.x,
      stealthPubY: stealthPubKey.y,
      token: TOKEN,
      recipient: RECIPIENT,
      amount: 1000000000000000000n, // 1 ETH
      nonce: generateNonce(),
    };

    const signed = signWithdrawal(stealthPrivKey, params);
    expect(signed.sigR).toBeTruthy();
    expect(signed.sigS).toBeTruthy();

    const valid = verifyWithdrawalSignature(signed);
    expect(valid).toBe(true);
  });

  it('should fail verification with wrong key', () => {
    const receiver = generateKeys();
    const other = generateKeys();
    const { stealthPubKey, ephemeralPubKey } = deriveStealthAddress(receiver.metaAddress);
    const stealthPrivKey = computeStealthPrivateKey(
      receiver.spendingKey,
      receiver.viewingKey,
      ephemeralPubKey,
    );

    const params = {
      stealthPubX: stealthPubKey.x,
      stealthPubY: stealthPubKey.y,
      token: TOKEN,
      recipient: RECIPIENT,
      amount: 500000000000000000n,
      nonce: generateNonce(),
    };

    // Sign with correct key
    const signed = signWithdrawal(stealthPrivKey, params);

    // Tamper: change recipient
    const tampered = { ...signed, recipient: '0xdeadbeef' };
    const valid = verifyWithdrawalSignature(tampered);
    expect(valid).toBe(false);
  });

  it('should produce different signatures for different nonces', () => {
    const receiver = generateKeys();
    const { stealthPubKey, ephemeralPubKey } = deriveStealthAddress(receiver.metaAddress);
    const stealthPrivKey = computeStealthPrivateKey(
      receiver.spendingKey,
      receiver.viewingKey,
      ephemeralPubKey,
    );

    const baseParams = {
      stealthPubX: stealthPubKey.x,
      stealthPubY: stealthPubKey.y,
      token: TOKEN,
      recipient: RECIPIENT,
      amount: 1000000000000000000n,
    };

    const signed1 = signWithdrawal(stealthPrivKey, { ...baseParams, nonce: 1n });
    const signed2 = signWithdrawal(stealthPrivKey, { ...baseParams, nonce: 2n });

    expect(signed1.sigR).not.toBe(signed2.sigR);

    // Both should verify
    expect(verifyWithdrawalSignature(signed1)).toBe(true);
    expect(verifyWithdrawalSignature(signed2)).toBe(true);
  });

  it('should hash deterministically', () => {
    const params = {
      stealthPubX: 123n,
      stealthPubY: 456n,
      token: TOKEN,
      recipient: RECIPIENT,
      amount: 1000n,
      nonce: 42n,
    };

    const hash1 = hashWithdrawalRequest(params);
    const hash2 = hashWithdrawalRequest(params);
    expect(hash1).toBe(hash2);
  });

  it('should generate unique nonces', () => {
    const n1 = generateNonce();
    const n2 = generateNonce();
    expect(n1).not.toBe(n2);
  });
});
