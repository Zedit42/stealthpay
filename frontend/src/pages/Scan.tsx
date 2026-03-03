import { useState } from 'react';
import type { WalletState } from '../App';
import { useStealthKeys } from '../hooks/useStealthKeys';
import {
  scanForPayments,
  computeStealthPrivateKey,
  signWithdrawal,
  signSplitWithdrawal,
  generateNonce,
} from '../crypto/stealth';
import { RpcProvider } from 'starknet';

const VAULT_ADDRESS = '0x07efc6272b3b1db522e63c114ef07d52cd1c0902d1102d3d0b5118c9a30c83d2';
const PROVIDER = new RpcProvider({ nodeUrl: 'https://rpc.starknet-testnet.lava.build' });

const TOKEN_NAMES: Record<string, string> = {
  '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7': 'ETH',
  '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d': 'STRK',
};

interface DetectedPayment {
  index: number;
  amount: bigint;
  amountDisplay: string;
  token: string;
  tokenName: string;
  stealthPubX: bigint;
  stealthPubY: bigint;
  ephPubX: bigint;
  ephPubY: bigint;
}

interface Props {
  wallet: WalletState;
  connectWallet: () => Promise<void>;
}

type WithdrawMode = 'normal' | 'split';

export default function Scan({ wallet, connectWallet }: Props) {
  const { keys, hasKeys } = useStealthKeys();
  const [scanning, setScanning] = useState(false);
  const [payments, setPayments] = useState<DetectedPayment[]>([]);
  const [scanned, setScanned] = useState(false);
  const [scanLog, setScanLog] = useState<string[]>([]);

  // Withdraw state
  const [withdrawing, setWithdrawing] = useState<number | null>(null);
  const [withdrawMode, setWithdrawMode] = useState<WithdrawMode>('normal');
  const [recipient, setRecipient] = useState('');
  const [splitRecipients, setSplitRecipients] = useState([
    { address: '', amount: '' },
    { address: '', amount: '' },
    { address: '', amount: '' },
  ]);
  const [withdrawStatus, setWithdrawStatus] = useState<string>('');
  const [withdrawTxHash, setWithdrawTxHash] = useState<string>('');

  const log = (msg: string) => setScanLog(prev => [...prev, msg]);

  const doScan = async () => {
    if (!hasKeys || !keys) return;
    setScanning(true);
    setPayments([]);
    setScanLog([]);

    try {
      log('Connecting to Starknet Sepolia...');
      const countResult = await PROVIDER.callContract({
        contractAddress: VAULT_ADDRESS,
        entrypoint: 'get_payment_count',
      });
      const count = Number(countResult[0]);
      log(`📊 Found ${count} total payments on-chain`);

      if (count === 0) {
        log('No payments to scan');
        setScanning(false);
        setScanned(true);
        return;
      }

      log('Scanning with viewing key...');
      const viewingKey = BigInt(keys.viewingKey);
      const spendingPubX = BigInt(keys.spendingPubX);
      const spendingPubY = BigInt(keys.spendingPubY);

      const paymentData: Array<{
        ephPubX: bigint; ephPubY: bigint;
        stealthX: bigint; stealthY: bigint;
        token: string; amount: bigint;
      }> = [];

      for (let i = 0; i < count; i++) {
        const result = await PROVIDER.callContract({
          contractAddress: VAULT_ADDRESS,
          entrypoint: 'get_payment',
          calldata: [i.toString()],
        });
        paymentData.push({
          stealthX: BigInt(result[0]),
          stealthY: BigInt(result[1]),
          ephPubX: BigInt(result[2]),
          ephPubY: BigInt(result[3]),
          token: result[4],
          amount: BigInt(result[5]),
        });
      }

      const matched = scanForPayments(viewingKey, spendingPubX, spendingPubY, paymentData);

      if (matched.length > 0) {
        log(`✅ Found ${matched.length} payment(s) for you!`);
        setPayments(matched.map(idx => {
          const pd = paymentData[idx];
          const tokenHex = '0x' + BigInt(pd.token).toString(16).padStart(64, '0');
          return {
            index: idx,
            amount: pd.amount,
            amountDisplay: (Number(pd.amount) / 1e18).toFixed(6),
            token: pd.token,
            tokenName: TOKEN_NAMES[tokenHex] || TOKEN_NAMES[pd.token] || 'TOKEN',
            stealthPubX: pd.stealthX,
            stealthPubY: pd.stealthY,
            ephPubX: pd.ephPubX,
            ephPubY: pd.ephPubY,
          };
        }));
      } else {
        log('No payments matched your viewing key');
      }
    } catch (err: any) {
      log(`❌ Error: ${err.message}`);
    }

    setScanning(false);
    setScanned(true);
  };

  const doWithdraw = async (payment: DetectedPayment) => {
    if (!keys) return;

    if (!wallet.isConnected) {
      await connectWallet();
      return;
    }

    setWithdrawStatus('Signing withdrawal...');

    try {
      const stealthPrivKey = computeStealthPrivateKey(
        BigInt(keys.spendingKey),
        BigInt(keys.viewingKey),
        payment.ephPubX,
        payment.ephPubY,
      );

      const nonce = generateNonce();
      const win = window as any;
      const starknetWallet = win.starknet_argentX || win.starknet_braavos || win.starknet;
      if (!starknetWallet?.account) throw new Error('Wallet not connected');

      if (withdrawMode === 'normal') {
        if (!recipient) { setWithdrawStatus('Enter recipient address'); return; }

        const sig = signWithdrawal(
          stealthPrivKey,
          payment.stealthPubX, payment.stealthPubY,
          payment.token, recipient,
          payment.amount, nonce,
        );

        setWithdrawStatus('Confirm in wallet (relayer submitting)...');

        const tx = await starknetWallet.account.execute([{
          contractAddress: VAULT_ADDRESS,
          entrypoint: 'withdraw',
          calldata: [
            '0x' + payment.stealthPubX.toString(16),
            '0x' + payment.stealthPubY.toString(16),
            payment.token,
            recipient,
            payment.amount.toString(), '0',
            '0x' + nonce.toString(16),
            sig.sigR, sig.sigS,
          ],
        }]);

        setWithdrawTxHash(tx.transaction_hash);
        setWithdrawStatus('✅ Withdrawn!');

      } else {
        // Split mode
        const active = splitRecipients.filter(r => r.address && r.amount);
        if (active.length === 0) { setWithdrawStatus('Add at least one recipient'); return; }

        const recipients = active.map(r => ({
          address: r.address,
          amount: BigInt(Math.floor(parseFloat(r.amount) * 1e18)),
        }));

        // Pad to 3
        while (recipients.length < 3) {
          recipients.push({ address: '0x0', amount: 0n });
        }

        const sig = signSplitWithdrawal(
          stealthPrivKey,
          payment.stealthPubX, payment.stealthPubY,
          payment.token,
          recipients,
          nonce,
        );

        setWithdrawStatus('Confirm in wallet (split withdraw)...');

        const tx = await starknetWallet.account.execute([{
          contractAddress: VAULT_ADDRESS,
          entrypoint: 'withdraw_split',
          calldata: [
            '0x' + payment.stealthPubX.toString(16),
            '0x' + payment.stealthPubY.toString(16),
            payment.token,
            recipients[0].address, recipients[0].amount.toString(), '0',
            recipients[1].address, recipients[1].amount.toString(), '0',
            recipients[2].address, recipients[2].amount.toString(), '0',
            active.length.toString(),
            '0x' + nonce.toString(16),
            sig.sigR, sig.sigS,
          ],
        }]);

        setWithdrawTxHash(tx.transaction_hash);
        setWithdrawStatus('✅ Split withdrawn!');
      }
    } catch (err: any) {
      setWithdrawStatus(`❌ ${err.message}`);
    }
  };

  if (!hasKeys) {
    return (
      <div className="page">
        <div className="card">
          <h2>Scan for Payments</h2>
          <p>You need to generate stealth keys first.</p>
          <a href="/" className="primary-btn inline-link">Go to Home</a>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="card">
        <h2>Scan for Payments</h2>
        <p>Scan the blockchain for payments sent to your stealth addresses.</p>

        <div className="key-info">
          <span className="badge success">Viewing Key Active</span>
          <code className="small">{keys!.viewingPubX.slice(0, 16)}...</code>
        </div>

        <button onClick={doScan} className="primary-btn" disabled={scanning}>
          {scanning ? <><span className="spinner-inline" /> Scanning...</> : 'Scan Blockchain'}
        </button>

        {scanLog.length > 0 && (
          <div className="scan-log">
            {scanLog.map((msg, i) => <div key={i} className="log-entry">{msg}</div>)}
          </div>
        )}

        {payments.length > 0 && (
          <div className="payments-list">
            <h3>Found Payments</h3>
            {payments.map((p) => (
              <div key={p.index} className="payment-card">
                <div className="payment-info">
                  <span className="amount">{p.amountDisplay} {p.tokenName}</span>
                  <code className="small">stealth: {('0x' + p.stealthPubX.toString(16)).slice(0, 14)}...</code>
                </div>

                {withdrawing === p.index ? (
                  <div className="withdraw-form">
                    <div className="mode-toggle">
                      <button
                        className={`mode-btn ${withdrawMode === 'normal' ? 'active' : ''}`}
                        onClick={() => setWithdrawMode('normal')}
                      >
                        🔄 Normal
                      </button>
                      <button
                        className={`mode-btn ${withdrawMode === 'split' ? 'active' : ''}`}
                        onClick={() => setWithdrawMode('split')}
                      >
                        ✂️ Split (Privacy+)
                      </button>
                    </div>

                    {withdrawMode === 'normal' ? (
                      <div className="form-group">
                        <label>Recipient Address</label>
                        <input
                          type="text"
                          value={recipient}
                          onChange={e => setRecipient(e.target.value)}
                          placeholder="0x..."
                        />
                        <p className="note">💡 Anyone can submit this tx (relayer pattern). Your stealth key signs, the connected wallet just relays.</p>
                      </div>
                    ) : (
                      <div className="split-form">
                        <p className="note">✂️ Split to multiple addresses for extra privacy</p>
                        {splitRecipients.map((sr, i) => (
                          <div key={i} className="split-row">
                            <input
                              type="text"
                              value={sr.address}
                              onChange={e => {
                                const updated = [...splitRecipients];
                                updated[i] = { ...updated[i], address: e.target.value };
                                setSplitRecipients(updated);
                              }}
                              placeholder={`Recipient ${i + 1} (0x...)`}
                            />
                            <input
                              type="number"
                              value={sr.amount}
                              onChange={e => {
                                const updated = [...splitRecipients];
                                updated[i] = { ...updated[i], amount: e.target.value };
                                setSplitRecipients(updated);
                              }}
                              placeholder="Amount"
                              step="0.0001"
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    {withdrawStatus && (
                      <div className={`status-msg ${withdrawStatus.startsWith('✅') ? 'success' : withdrawStatus.startsWith('❌') ? 'error' : ''}`}>
                        {withdrawStatus}
                      </div>
                    )}

                    {withdrawTxHash && (
                      <a
                        href={`https://sepolia.voyager.online/tx/${withdrawTxHash}`}
                        target="_blank" rel="noopener"
                        className="tx-link"
                      >
                        View TX ↗
                      </a>
                    )}

                    <div className="withdraw-actions">
                      <button className="primary-btn" onClick={() => doWithdraw(p)}>
                        {wallet.isConnected ? 'Sign & Withdraw' : 'Connect Wallet'}
                      </button>
                      <button className="secondary-btn" onClick={() => { setWithdrawing(null); setWithdrawStatus(''); setWithdrawTxHash(''); }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button className="withdraw-btn" onClick={() => {
                    setWithdrawing(p.index);
                    setWithdrawStatus('');
                    setWithdrawTxHash('');
                    setRecipient(wallet.address || '');
                  }}>
                    Withdraw
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {scanned && payments.length === 0 && !scanning && (
          <div className="empty-state">
            <p>No payments found</p>
            <p className="note">Share your payment link to receive private payments!</p>
          </div>
        )}
      </div>

      <div className="card">
        <h2>Privacy Features</h2>
        <div className="info-grid">
          <div className="info-item">
            <strong>🔄 Relayer Pattern</strong>
            <p>Anyone can submit the withdrawal tx. Your stealth key signs off-chain — the relayer just pays gas.</p>
          </div>
          <div className="info-item">
            <strong>✂️ Split Withdrawal</strong>
            <p>Split funds to up to 3 different addresses. Makes on-chain analysis much harder.</p>
          </div>
          <div className="info-item">
            <strong>🔒 Client-side Scanning</strong>
            <p>Your viewing key never leaves the browser. All matching happens locally.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
