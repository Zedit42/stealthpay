/**
 * Poseidon hash wrapper for Starknet
 * Uses starknet.js built-in Poseidon
 */

import { hash } from 'starknet';

/**
 * Poseidon hash of two field elements
 * Returns a field element (bigint)
 */
export function poseidonHash(a: bigint, b: bigint): bigint {
  const result = hash.computePoseidonHash(
    '0x' + a.toString(16),
    '0x' + b.toString(16),
  );
  return BigInt(result);
}

/**
 * Poseidon hash of multiple field elements
 */
export function poseidonHashMany(...values: bigint[]): bigint {
  const hexValues = values.map((v) => '0x' + v.toString(16));
  const result = hash.computePoseidonHashOnElements(hexValues);
  return BigInt(result);
}
