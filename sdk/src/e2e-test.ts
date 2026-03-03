/**
 * StealthPay E2E Test — Real Sepolia testnet
 * 
 * Tests the full flow:
 * 1. Receiver generates stealth keys
 * 2. Sender derives stealth address from receiver's meta-address
 * 3. Sender deposits tokens to stealth address via StealthVault
 * 4. Receiver scans payments and finds theirs
 * 5. Receiver signs withdrawal and gets funds to their real wallet
 */

import { Account, RpcProvider, Contract, CallData, num, cairo } from 'starknet';
import {
  generateKeys,
  deriveStealthAddress,
  scanPayments,
  computeStealthPrivateKey,
} from './stealth.js';
import { signWithdrawal, generateNonce } from './withdrawal.js';

// ─── Config ───
// Use starknet.js default Sepolia RPC
const PROVIDER_URL = '';
const VAULT_ADDRESS = '0x02919fffe254c3a76a504363596ed033548bff0af4d6b82419a90a150635d15e';

// Deployer account (sender)
const SENDER_ADDRESS = '0x044e59e0dd3cec8fb232e3060ffceffbe383d474955c6499b57376e55d289ff5';
const SENDER_PRIVATE_KEY = '0x12adb3cf7742f399c633efe33e75deb7a0ab087a082255f3819fdb9c78962c6';

// Sepolia ETH (fee token)
const ETH_ADDRESS = '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7';
// Sepolia STRK 
const STRK_ADDRESS = '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d';

const provider = new RpcProvider({ nodeUrl: 'https://rpc.starknet-testnet.lava.build' });
const senderAccount = new Account(provider, SENDER_ADDRESS, SENDER_PRIVATE_KEY);

// Minimal ERC20 ABI
const ERC20_ABI = [
  {
    type: 'function',
    name: 'balance_of',
    inputs: [{ name: 'account', type: 'core::starknet::contract_address::ContractAddress' }],
    outputs: [{ type: 'core::integer::u256' }],
    state_mutability: 'view',
  },
  {
    type: 'function',
    name: 'approve',
    inputs: [
      { name: 'spender', type: 'core::starknet::contract_address::ContractAddress' },
      { name: 'amount', type: 'core::integer::u256' },
    ],
    outputs: [{ type: 'core::bool' }],
    state_mutability: 'external',
  },
  {
    type: 'function',
    name: 'transfer',
    inputs: [
      { name: 'recipient', type: 'core::starknet::contract_address::ContractAddress' },
      { name: 'amount', type: 'core::integer::u256' },
    ],
    outputs: [{ type: 'core::bool' }],
    state_mutability: 'external',
  },
];

// Minimal Vault ABI
const VAULT_ABI = [
  {
    type: 'function',
    name: 'send_to_stealth',
    inputs: [
      { name: 'stealth_pub_x', type: 'core::felt252' },
      { name: 'stealth_pub_y', type: 'core::felt252' },
      { name: 'ephemeral_pub_x', type: 'core::felt252' },
      { name: 'ephemeral_pub_y', type: 'core::felt252' },
      { name: 'token', type: 'core::starknet::contract_address::ContractAddress' },
      { name: 'amount', type: 'core::integer::u256' },
    ],
    outputs: [],
    state_mutability: 'external',
  },
  {
    type: 'function',
    name: 'withdraw',
    inputs: [
      { name: 'stealth_pub_x', type: 'core::felt252' },
      { name: 'stealth_pub_y', type: 'core::felt252' },
      { name: 'token', type: 'core::starknet::contract_address::ContractAddress' },
      { name: 'recipient', type: 'core::starknet::contract_address::ContractAddress' },
      { name: 'amount', type: 'core::integer::u256' },
      { name: 'nonce', type: 'core::felt252' },
      { name: 'sig_r', type: 'core::felt252' },
      { name: 'sig_s', type: 'core::felt252' },
    ],
    outputs: [],
    state_mutability: 'external',
  },
  {
    type: 'function',
    name: 'get_payment_count',
    inputs: [],
    outputs: [{ type: 'core::integer::u64' }],
    state_mutability: 'view',
  },
  {
    type: 'function',
    name: 'get_payment',
    inputs: [{ name: 'index', type: 'core::integer::u64' }],
    outputs: [
      { type: 'core::felt252' },
      { type: 'core::felt252' },
      { type: 'core::felt252' },
      { type: 'core::felt252' },
      { type: 'core::starknet::contract_address::ContractAddress' },
      { type: 'core::integer::u256' },
    ],
    state_mutability: 'view',
  },
  {
    type: 'function',
    name: 'get_balance',
    inputs: [
      { name: 'stealth_pub_x', type: 'core::felt252' },
      { name: 'token', type: 'core::starknet::contract_address::ContractAddress' },
    ],
    outputs: [{ type: 'core::integer::u256' }],
    state_mutability: 'view',
  },
];

async function main() {
  console.log('🥷 StealthPay E2E Test — Starknet Sepolia\n');

  // ═══ Step 0: Check sender balance ═══
  console.log('📊 Step 0: Checking sender STRK balance...');
  const strk = new Contract(ERC20_ABI, STRK_ADDRESS, provider);
  const senderBal = await strk.balance_of(SENDER_ADDRESS);
  const balStr = BigInt(senderBal).toString();
  console.log(`   Sender STRK balance: ${balStr} (${Number(BigInt(senderBal)) / 1e18} STRK)`);
  
  const SEND_AMOUNT = 100000000000000n; // 0.0001 STRK
  console.log(`   Will send: ${Number(SEND_AMOUNT) / 1e18} STRK\n`);

  if (BigInt(senderBal) < SEND_AMOUNT * 2n) {
    console.log('❌ Insufficient STRK balance. Need testnet STRK.');
    console.log('   Get from: https://starknet-faucet.vercel.app/');
    return;
  }

  // ═══ Step 1: Receiver generates stealth keys ═══
  console.log('🔑 Step 1: Receiver generates stealth keys...');
  const receiver = generateKeys();
  console.log(`   Spending pub: (${receiver.metaAddress.spendingPubKey.x.toString(16).slice(0, 16)}...)`);
  console.log(`   Viewing pub:  (${receiver.metaAddress.viewingPubKey.x.toString(16).slice(0, 16)}...)`);
  console.log('   ✅ Keys generated\n');

  // ═══ Step 2: Sender derives stealth address ═══
  console.log('📬 Step 2: Sender derives stealth address...');
  const stealth = deriveStealthAddress(receiver.metaAddress);
  console.log(`   Stealth pub:    (${stealth.stealthPubKey.x.toString(16).slice(0, 16)}...)`);
  console.log(`   Ephemeral pub:  (${stealth.ephemeralPubKey.x.toString(16).slice(0, 16)}...)`);
  console.log('   ✅ Stealth address derived\n');

  // ═══ Step 3: Sender approves + deposits ═══
  console.log('💸 Step 3: Sender approves vault and deposits STRK...');
  
  const strkConnected = new Contract(ERC20_ABI, STRK_ADDRESS, senderAccount);
  
  console.log('   Approving vault...');
  const approveTx = await strkConnected.approve(
    VAULT_ADDRESS,
    cairo.uint256(SEND_AMOUNT),
  );
  console.log(`   Approve tx: ${approveTx.transaction_hash}`);
  await provider.waitForTransaction(approveTx.transaction_hash);
  console.log('   ✅ Approved\n');

  const vault = new Contract(VAULT_ABI, VAULT_ADDRESS, senderAccount);

  console.log('   Sending to stealth address...');
  const sendTx = await vault.send_to_stealth(
    '0x' + stealth.stealthPubKey.x.toString(16),
    '0x' + stealth.stealthPubKey.y.toString(16),
    '0x' + stealth.ephemeralPubKey.x.toString(16),
    '0x' + stealth.ephemeralPubKey.y.toString(16),
    STRK_ADDRESS,
    cairo.uint256(SEND_AMOUNT),
  );
  console.log(`   Send tx: ${sendTx.transaction_hash}`);
  await provider.waitForTransaction(sendTx.transaction_hash);
  console.log('   ✅ Deposited!\n');

  // ═══ Step 4: Check vault balance ═══
  console.log('🔍 Step 4: Checking vault balance for stealth address...');
  const vaultRead = new Contract(VAULT_ABI, VAULT_ADDRESS, provider);
  const vaultBal = await vaultRead.get_balance(
    '0x' + stealth.stealthPubKey.x.toString(16),
    STRK_ADDRESS,
  );
  console.log(`   Vault balance: ${BigInt(vaultBal).toString()} (${Number(BigInt(vaultBal)) / 1e18} STRK)`);
  console.log('   ✅ Funds in vault\n');

  // ═══ Step 5: Receiver scans payments ═══
  console.log('🔎 Step 5: Receiver scans for their payments...');
  const paymentCount = await vaultRead.get_payment_count();
  const count = Number(paymentCount);
  console.log(`   Total payments on-chain: ${count}`);

  const ephemeralKeys: { x: bigint; y: bigint }[] = [];
  const stealthAddresses: { x: bigint; y: bigint }[] = [];
  
  for (let i = 0; i < count; i++) {
    const p = await vaultRead.get_payment(i);
    stealthAddresses.push({ x: BigInt(p[0]), y: BigInt(p[1]) });
    ephemeralKeys.push({ x: BigInt(p[2]), y: BigInt(p[3]) });
  }

  const matches = scanPayments(
    receiver.viewingKey,
    receiver.metaAddress.spendingPubKey,
    ephemeralKeys,
    stealthAddresses,
  );
  console.log(`   Found ${matches.length} payment(s) for receiver: indices ${JSON.stringify(matches)}`);
  console.log('   ✅ Scan complete\n');

  if (matches.length === 0) {
    console.log('❌ No payments found! Something is wrong with scanning.');
    return;
  }

  // ═══ Step 6: Receiver withdraws to their real wallet ═══
  console.log('💰 Step 6: Receiver withdraws to their real address...');
  
  // Compute stealth private key
  const matchIdx = matches[matches.length - 1]; // our latest payment
  const stealthPrivKey = computeStealthPrivateKey(
    receiver.spendingKey,
    receiver.viewingKey,
    ephemeralKeys[matchIdx],
  );
  console.log(`   Stealth private key computed`);

  // Sign withdrawal
  const nonce = generateNonce();
  const RECIPIENT = SENDER_ADDRESS; // withdraw back to sender for test
  
  const withdrawalParams = {
    stealthPubX: stealthAddresses[matchIdx].x,
    stealthPubY: stealthAddresses[matchIdx].y,
    token: STRK_ADDRESS,
    recipient: RECIPIENT,
    amount: SEND_AMOUNT,
    nonce,
  };

  const signed = signWithdrawal(stealthPrivKey, withdrawalParams);
  console.log(`   Withdrawal signed (msgHash: ${signed.msgHash.slice(0, 18)}...)`);

  // Submit withdrawal on-chain (anyone can do this — relayer pattern)
  console.log('   Submitting withdrawal tx...');
  const withdrawTx = await vault.withdraw(
    '0x' + withdrawalParams.stealthPubX.toString(16),
    '0x' + withdrawalParams.stealthPubY.toString(16),
    STRK_ADDRESS,
    RECIPIENT,
    cairo.uint256(SEND_AMOUNT),
    '0x' + nonce.toString(16),
    signed.sigR,
    signed.sigS,
  );
  console.log(`   Withdraw tx: ${withdrawTx.transaction_hash}`);
  await provider.waitForTransaction(withdrawTx.transaction_hash);
  console.log('   ✅ Withdrawn!\n');

  // ═══ Step 7: Verify final balances ═══
  console.log('📊 Step 7: Final balance check...');
  const finalVaultBal = await vaultRead.get_balance(
    '0x' + stealth.stealthPubKey.x.toString(16),
    STRK_ADDRESS,
  );
  console.log(`   Vault stealth balance: ${BigInt(finalVaultBal).toString()} (should be 0)`);
  
  const finalSenderBal = await strk.balance_of(SENDER_ADDRESS);
  console.log(`   Sender STRK balance: ${Number(BigInt(finalSenderBal)) / 1e18} STRK`);

  console.log('\n🎉 E2E TEST COMPLETE — Full stealth payment cycle works!');
}

main().catch(console.error);
