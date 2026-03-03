/**
 * Withdrawal signing — prove ownership of stealth private key
 *
 * The stealth key holder signs a withdrawal message off-chain.
 * Anyone can then submit this signed message on-chain (relayer pattern).
 * The contract verifies the signature against the stealth public key.
 */

import { ec, hash, encode } from 'starknet';

const { starkCurve } = ec;

export interface WithdrawalParams {
  stealthPubX: bigint;
  stealthPubY: bigint;
  token: string; // contract address hex
  recipient: string; // contract address hex
  amount: bigint;
  nonce: bigint;
}

export interface SignedWithdrawal extends WithdrawalParams {
  sigR: string;
  sigS: string;
  msgHash: string;
}

/**
 * Hash a withdrawal request using Poseidon (matches on-chain logic)
 */
export function hashWithdrawalRequest(params: WithdrawalParams): bigint {
  const amountLow = params.amount & ((1n << 128n) - 1n);
  const amountHigh = params.amount >> 128n;

  const result = hash.computePoseidonHashOnElements([
    '0x' + params.stealthPubX.toString(16),
    '0x' + params.stealthPubY.toString(16),
    params.token,
    params.recipient,
    '0x' + amountLow.toString(16),
    '0x' + amountHigh.toString(16),
    '0x' + params.nonce.toString(16),
  ]);

  return BigInt(result);
}

/**
 * Sign a withdrawal request with the stealth private key
 */
export function signWithdrawal(
  stealthPrivateKey: bigint,
  params: WithdrawalParams,
): SignedWithdrawal {
  const msgHash = hashWithdrawalRequest(params);

  const privKeyHex = '0x' + stealthPrivateKey.toString(16);
  const msgHashHex = '0x' + msgHash.toString(16);

  const signature = starkCurve.sign(msgHashHex, privKeyHex);

  return {
    ...params,
    sigR: '0x' + signature.r.toString(16),
    sigS: '0x' + signature.s.toString(16),
    msgHash: msgHashHex,
  };
}

/**
 * Verify a signed withdrawal off-chain (for testing / UI feedback)
 * Uses the full public key (uncompressed) for verification.
 */
export function verifyWithdrawalSignature(signed: SignedWithdrawal): boolean {
  const msgHash = hashWithdrawalRequest(signed);
  const msgHashHex = '0x' + msgHash.toString(16);

  // Reconstruct full public key from x,y coordinates
  const { ProjectivePoint, Signature } = starkCurve;
  const fullPubKey = ProjectivePoint.fromAffine({
    x: signed.stealthPubX,
    y: signed.stealthPubY,
  });
  const pubKeyBytes = fullPubKey.toRawBytes();

  const sig = new Signature(BigInt(signed.sigR), BigInt(signed.sigS));

  return starkCurve.verify(sig, msgHashHex, pubKeyBytes);
}

/**
 * Generate a random nonce for replay protection
 */
export function generateNonce(): bigint {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let nonce = 0n;
  for (const b of bytes) {
    nonce = (nonce << 8n) | BigInt(b);
  }
  return nonce;
}
