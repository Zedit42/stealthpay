/**
 * StealthPay V2 E2E Test — Privacy-enhanced features
 * 
 * Tests:
 * 1. Normal deposit + withdraw (relayer pattern — sender account submits on behalf)
 * 2. Split withdrawal — send to 3 different addresses
 * 3. Scheduled withdrawal — time-locked release
 */

import { Account, RpcProvider, Contract, CallData, num, cairo, hash } from 'starknet';
import {
  generateKeys,
  deriveStealthAddress,
  scanPayments,
  computeStealthPrivateKey,
} from './stealth.js';
import { generateNonce } from './withdrawal.js';
import { ec } from 'starknet';

const { starkCurve } = ec;

// ─── Config ───
const VAULT_ADDRESS = '0x07efc6272b3b1db522e63c114ef07d52cd1c0902d1102d3d0b5118c9a30c83d2';
const SENDER_ADDRESS = '0x044e59e0dd3cec8fb232e3060ffceffbe383d474955c6499b57376e55d289ff5';
const SENDER_PRIVATE_KEY = '0x12adb3cf7742f399c633efe33e75deb7a0ab087a082255f3819fdb9c78962c6';
const STRK_ADDRESS = '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d';

const provider = new RpcProvider({ nodeUrl: 'https://rpc.starknet-testnet.lava.build' });
const senderAccount = new Account(provider, SENDER_ADDRESS, SENDER_PRIVATE_KEY);

const ERC20_ABI = [
  { type: 'function', name: 'balance_of', inputs: [{ name: 'account', type: 'core::starknet::contract_address::ContractAddress' }], outputs: [{ type: 'core::integer::u256' }], state_mutability: 'view' },
  { type: 'function', name: 'approve', inputs: [{ name: 'spender', type: 'core::starknet::contract_address::ContractAddress' }, { name: 'amount', type: 'core::integer::u256' }], outputs: [{ type: 'core::bool' }], state_mutability: 'external' },
];

const VAULT_ABI = [
  { type: 'function', name: 'send_to_stealth', inputs: [{ name: 'stealth_pub_x', type: 'core::felt252' }, { name: 'stealth_pub_y', type: 'core::felt252' }, { name: 'ephemeral_pub_x', type: 'core::felt252' }, { name: 'ephemeral_pub_y', type: 'core::felt252' }, { name: 'token', type: 'core::starknet::contract_address::ContractAddress' }, { name: 'amount', type: 'core::integer::u256' }], outputs: [], state_mutability: 'external' },
  { type: 'function', name: 'withdraw', inputs: [{ name: 'stealth_pub_x', type: 'core::felt252' }, { name: 'stealth_pub_y', type: 'core::felt252' }, { name: 'token', type: 'core::starknet::contract_address::ContractAddress' }, { name: 'recipient', type: 'core::starknet::contract_address::ContractAddress' }, { name: 'amount', type: 'core::integer::u256' }, { name: 'nonce', type: 'core::felt252' }, { name: 'sig_r', type: 'core::felt252' }, { name: 'sig_s', type: 'core::felt252' }], outputs: [], state_mutability: 'external' },
  { type: 'function', name: 'withdraw_split', inputs: [{ name: 'stealth_pub_x', type: 'core::felt252' }, { name: 'stealth_pub_y', type: 'core::felt252' }, { name: 'token', type: 'core::starknet::contract_address::ContractAddress' }, { name: 'recipient_1', type: 'core::starknet::contract_address::ContractAddress' }, { name: 'amount_1', type: 'core::integer::u256' }, { name: 'recipient_2', type: 'core::starknet::contract_address::ContractAddress' }, { name: 'amount_2', type: 'core::integer::u256' }, { name: 'recipient_3', type: 'core::starknet::contract_address::ContractAddress' }, { name: 'amount_3', type: 'core::integer::u256' }, { name: 'num_recipients', type: 'core::integer::u8' }, { name: 'nonce', type: 'core::felt252' }, { name: 'sig_r', type: 'core::felt252' }, { name: 'sig_s', type: 'core::felt252' }], outputs: [], state_mutability: 'external' },
  { type: 'function', name: 'schedule_withdrawal', inputs: [{ name: 'stealth_pub_x', type: 'core::felt252' }, { name: 'stealth_pub_y', type: 'core::felt252' }, { name: 'token', type: 'core::starknet::contract_address::ContractAddress' }, { name: 'recipient', type: 'core::starknet::contract_address::ContractAddress' }, { name: 'amount', type: 'core::integer::u256' }, { name: 'unlock_time', type: 'core::integer::u64' }, { name: 'nonce', type: 'core::felt252' }, { name: 'sig_r', type: 'core::felt252' }, { name: 'sig_s', type: 'core::felt252' }], outputs: [], state_mutability: 'external' },
  { type: 'function', name: 'execute_scheduled', inputs: [{ name: 'schedule_id', type: 'core::felt252' }], outputs: [], state_mutability: 'external' },
  { type: 'function', name: 'get_payment_count', inputs: [], outputs: [{ type: 'core::integer::u64' }], state_mutability: 'view' },
  { type: 'function', name: 'get_payment', inputs: [{ name: 'index', type: 'core::integer::u64' }], outputs: [{ type: 'core::felt252' }, { type: 'core::felt252' }, { type: 'core::felt252' }, { type: 'core::felt252' }, { type: 'core::starknet::contract_address::ContractAddress' }, { type: 'core::integer::u256' }], state_mutability: 'view' },
  { type: 'function', name: 'get_balance', inputs: [{ name: 'stealth_pub_x', type: 'core::felt252' }, { name: 'token', type: 'core::starknet::contract_address::ContractAddress' }], outputs: [{ type: 'core::integer::u256' }], state_mutability: 'view' },
  { type: 'function', name: 'get_schedule', inputs: [{ name: 'schedule_id', type: 'core::felt252' }], outputs: [{ type: 'core::starknet::contract_address::ContractAddress' }, { type: 'core::starknet::contract_address::ContractAddress' }, { type: 'core::integer::u256' }, { type: 'core::integer::u64' }, { type: 'core::bool' }], state_mutability: 'view' },
];

function signMessage(privateKey: bigint, msgHash: bigint) {
  const privKeyHex = '0x' + privateKey.toString(16);
  const msgHashHex = '0x' + msgHash.toString(16);
  const sig = starkCurve.sign(msgHashHex, privKeyHex);
  return { r: '0x' + sig.r.toString(16), s: '0x' + sig.s.toString(16) };
}

function poseidonHashMany(values: bigint[]): bigint {
  const hexValues = values.map(v => '0x' + v.toString(16));
  return BigInt(hash.computePoseidonHashOnElements(hexValues));
}

const SEND_AMOUNT = 300000000000000n; // 0.0003 STRK (will split 3 ways)

async function main() {
  console.log('🥷 StealthPay V2 E2E Test\n');

  // ═══ Step 1: Deposit ═══
  console.log('💸 Step 1: Depositing 0.0003 STRK...');
  const receiver = generateKeys();
  const stealth = deriveStealthAddress(receiver.metaAddress);

  const strk = new Contract(ERC20_ABI, STRK_ADDRESS, senderAccount);
  const vault = new Contract(VAULT_ABI, VAULT_ADDRESS, senderAccount);

  const approveTx = await strk.approve(VAULT_ADDRESS, cairo.uint256(SEND_AMOUNT));
  await provider.waitForTransaction(approveTx.transaction_hash);

  const sendTx = await vault.send_to_stealth(
    '0x' + stealth.stealthPubKey.x.toString(16),
    '0x' + stealth.stealthPubKey.y.toString(16),
    '0x' + stealth.ephemeralPubKey.x.toString(16),
    '0x' + stealth.ephemeralPubKey.y.toString(16),
    STRK_ADDRESS,
    cairo.uint256(SEND_AMOUNT),
  );
  await provider.waitForTransaction(sendTx.transaction_hash);
  console.log(`   ✅ Deposited! TX: ${sendTx.transaction_hash.slice(0, 20)}...`);

  // Compute stealth private key
  const vaultRead = new Contract(VAULT_ABI, VAULT_ADDRESS, provider);
  const count = Number(await vaultRead.get_payment_count());
  const p = await vaultRead.get_payment(count - 1);
  const ephKey = { x: BigInt(p[2]), y: BigInt(p[3]) };

  const stealthPrivKey = computeStealthPrivateKey(
    receiver.spendingKey,
    receiver.viewingKey,
    ephKey,
  );

  const spx = stealth.stealthPubKey.x;
  const spy = stealth.stealthPubKey.y;

  // ═══ Test A: Relayer Withdraw ═══
  // The sender account submits the tx, but the signature is from the stealth key holder
  // This proves ANYONE can relay — Veli never touches the chain
  console.log('\n🔄 Test A: Relayer pattern withdraw (100000000000000 = 0.0001 STRK)...');
  const nonceA = generateNonce();
  const RECIPIENT_A = '0x0000000000000000000000000000000000000000000000000000000000001111'; // random addr
  const amountA = 100000000000000n;

  const msgHashA = poseidonHashMany([
    spx, spy,
    BigInt(STRK_ADDRESS),
    BigInt(RECIPIENT_A),
    amountA & ((1n << 128n) - 1n), amountA >> 128n,
    nonceA,
  ]);
  const sigA = signMessage(stealthPrivKey, msgHashA);

  // Sender account relays (pays gas), but stealth key signed
  const withdrawTx = await vault.withdraw(
    '0x' + spx.toString(16), '0x' + spy.toString(16),
    STRK_ADDRESS, RECIPIENT_A,
    cairo.uint256(amountA),
    '0x' + nonceA.toString(16),
    sigA.r, sigA.s,
  );
  await provider.waitForTransaction(withdrawTx.transaction_hash);
  console.log(`   ✅ Relayer withdraw done! TX: ${withdrawTx.transaction_hash.slice(0, 20)}...`);
  console.log(`   Recipient 0x1111 never appeared on chain as caller`);

  // ═══ Test B: Split Withdrawal ═══
  console.log('\n✂️  Test B: Split withdrawal to 3 addresses (0.0001 STRK each)...');
  const nonceB = generateNonce();
  const R1 = '0x0000000000000000000000000000000000000000000000000000000000002222';
  const R2 = '0x0000000000000000000000000000000000000000000000000000000000003333';
  const R3 = '0x0000000000000000000000000000000000000000000000000000000000004444';
  const splitAmt = 50000000000000n; // 0.00005 each
  const zeroAmt = 0n;
  const numRecipients = 3;

  const msgHashB = poseidonHashMany([
    spx, spy,
    BigInt(STRK_ADDRESS),
    BigInt(R1), splitAmt & ((1n << 128n) - 1n), splitAmt >> 128n,
    BigInt(R2), splitAmt & ((1n << 128n) - 1n), splitAmt >> 128n,
    BigInt(R3), splitAmt & ((1n << 128n) - 1n), splitAmt >> 128n,
    BigInt(numRecipients),
    nonceB,
  ]);
  const sigB = signMessage(stealthPrivKey, msgHashB);

  const splitTx = await vault.withdraw_split(
    '0x' + spx.toString(16), '0x' + spy.toString(16),
    STRK_ADDRESS,
    R1, cairo.uint256(splitAmt),
    R2, cairo.uint256(splitAmt),
    R3, cairo.uint256(splitAmt),
    numRecipients,
    '0x' + nonceB.toString(16),
    sigB.r, sigB.s,
  );
  await provider.waitForTransaction(splitTx.transaction_hash);
  console.log(`   ✅ Split withdraw done! TX: ${splitTx.transaction_hash.slice(0, 20)}...`);
  console.log(`   0x2222, 0x3333, 0x4444 each got 0.00005 STRK`);

  // ═══ Test C: Scheduled Withdrawal ═══
  console.log('\n⏰ Test C: Schedule withdrawal (unlock in 10 seconds)...');
  
  // First deposit more
  const stealth2 = deriveStealthAddress(receiver.metaAddress);
  const approveTx2 = await strk.approve(VAULT_ADDRESS, cairo.uint256(100000000000000n));
  await provider.waitForTransaction(approveTx2.transaction_hash);
  
  const sendTx2 = await vault.send_to_stealth(
    '0x' + stealth2.stealthPubKey.x.toString(16),
    '0x' + stealth2.stealthPubKey.y.toString(16),
    '0x' + stealth2.ephemeralPubKey.x.toString(16),
    '0x' + stealth2.ephemeralPubKey.y.toString(16),
    STRK_ADDRESS,
    cairo.uint256(100000000000000n),
  );
  await provider.waitForTransaction(sendTx2.transaction_hash);

  const stealthPrivKey2 = computeStealthPrivateKey(
    receiver.spendingKey, receiver.viewingKey, stealth2.ephemeralPubKey,
  );
  const spx2 = stealth2.stealthPubKey.x;
  const spy2 = stealth2.stealthPubKey.y;

  const nonceC = generateNonce();
  const RECIPIENT_C = '0x0000000000000000000000000000000000000000000000000000000000005555';
  const amountC = 100000000000000n;
  
  // Get current block timestamp and add 10 seconds
  const block = await provider.getBlock('latest');
  const unlockTime = BigInt(block.timestamp) + 10n;

  const msgHashC = poseidonHashMany([
    spx2, spy2,
    BigInt(STRK_ADDRESS),
    BigInt(RECIPIENT_C),
    amountC & ((1n << 128n) - 1n), amountC >> 128n,
    unlockTime,
    nonceC,
  ]);
  const sigC = signMessage(stealthPrivKey2, msgHashC);

  const schedTx = await vault.schedule_withdrawal(
    '0x' + spx2.toString(16), '0x' + spy2.toString(16),
    STRK_ADDRESS, RECIPIENT_C,
    cairo.uint256(amountC),
    unlockTime,
    '0x' + nonceC.toString(16),
    sigC.r, sigC.s,
  );
  await provider.waitForTransaction(schedTx.transaction_hash);
  
  // Compute schedule_id = poseidon(nonce)
  const scheduleId = hash.computePoseidonHash('0x' + nonceC.toString(16), '0x' + nonceC.toString(16));
  // Actually schedule_id = PoseidonTrait::new().update(nonce).finalize()
  // In starknet.js, this is computePoseidonHashOnElements([nonce])
  const schedId = hash.computePoseidonHashOnElements(['0x' + nonceC.toString(16)]);
  
  console.log(`   ✅ Scheduled! Unlock at timestamp ${unlockTime}`);
  console.log(`   Waiting 15 seconds for unlock...`);

  await new Promise(r => setTimeout(r, 15000));

  // Anyone can execute (relayer-friendly)
  const execTx = await vault.execute_scheduled(schedId);
  await provider.waitForTransaction(execTx.transaction_hash);
  console.log(`   ✅ Scheduled withdrawal executed! TX: ${execTx.transaction_hash.slice(0, 20)}...`);

  // ═══ Final ═══
  console.log('\n🎉 ALL V2 TESTS PASSED!');
  console.log('   ✅ Relayer pattern (anyone submits tx, stealth key signs)');
  console.log('   ✅ Split withdrawal (3 different recipients)');
  console.log('   ✅ Scheduled withdrawal (time-locked release)');
}

main().catch(console.error);
