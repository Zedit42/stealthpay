import { useState } from 'react';
import type { WalletState } from '../App';
import { useStealthKeys } from '../hooks/useStealthKeys';
import { scanForPayments } from '../crypto/stealth';
import { RpcProvider } from 'starknet';

const VAULT_ADDRESS = '0x02919fffe254c3a76a504363596ed033548bff0af4d6b82419a90a150635d15e';
const PROVIDER = new RpcProvider({ nodeUrl: 'https://free-rpc.nethermind.io/sepolia-juno/v0_7' });

interface DetectedPayment {
  index: number;
  amount: string;
  token: string;
  stealthPubX: string;
  ephPubX: string;
}

interface Props {
  wallet: WalletState;
  connectWallet: () => Promise<void>;
}

export default function Scan({ wallet, connectWallet }: Props) {
  const { keys, hasKeys } = useStealthKeys();
  const [scanning, setScanning] = useState(false);
  const [payments, setPayments] = useState<DetectedPayment[]>([]);
  const [scanned, setScanned] = useState(false);
  const [scanLog, setScanLog] = useState<string[]>([]);

  const doScan = async () => {
    if (!hasKeys || !keys) return;
    setScanning(true);
    setPayments([]);
    setScanLog([]);

    const log = (msg: string) => setScanLog(prev => [...prev, msg]);

    try {
      log('Connecting to Starknet Sepolia...');

      // Fetch payment count from vault
      log('Reading vault contract...');
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

      // Fetch each payment and try to match
      log(`Scanning with viewing key...`);
      const viewingKey = BigInt(keys.viewingKey);
      const spendingPubX = BigInt(keys.spendingPubX);
      const spendingPubY = BigInt(keys.spendingPubY);

      const paymentData: Array<{
        ephPubX: bigint; ephPubY: bigint;
        stealthX: bigint; stealthY: bigint;
        token: string; amount: string;
      }> = [];

      for (let i = 0; i < count; i++) {
        const result = await PROVIDER.callContract({
          contractAddress: VAULT_ADDRESS,
          entrypoint: 'get_payment',
          calldata: [i.toString()],
        });
        // Returns: (stealth_pub_x, stealth_pub_y, eph_pub_x, eph_pub_y, token, amount)
        paymentData.push({
          ephPubX: BigInt(result[2]),
          ephPubY: BigInt(result[3]),
          stealthX: BigInt(result[0]),
          stealthY: BigInt(result[1]),
          token: result[4],
          amount: result[5],
        });
      }

      // Try matching each payment
      const matched = scanForPayments(viewingKey, spendingPubX, spendingPubY, paymentData);

      if (matched.length > 0) {
        log(`✅ Found ${matched.length} payment(s) for you!`);
        setPayments(matched.map(idx => ({
          index: idx,
          amount: (Number(BigInt(paymentData[idx].amount)) / 1e18).toFixed(6),
          token: 'ETH',
          stealthPubX: '0x' + paymentData[idx].stealthX.toString(16),
          ephPubX: '0x' + paymentData[idx].ephPubX.toString(16),
        })));
      } else {
        log('No payments matched your viewing key');
      }
    } catch (err: any) {
      log(`❌ Error: ${err.message}`);
    }

    setScanning(false);
    setScanned(true);
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
        <p>
          Scan the blockchain for payments sent to your stealth addresses.
          Only your viewing key can detect these payments.
        </p>

        <div className="key-info">
          <span className="badge success">Viewing Key Active</span>
          <code className="small">{keys!.viewingPubX.slice(0, 16)}...</code>
        </div>

        <button onClick={doScan} className="primary-btn" disabled={scanning}>
          {scanning ? (
            <>
              <span className="spinner-inline" /> Scanning...
            </>
          ) : (
            'Scan Blockchain'
          )}
        </button>

        {scanLog.length > 0 && (
          <div className="scan-log">
            {scanLog.map((msg, i) => (
              <div key={i} className="log-entry">{msg}</div>
            ))}
          </div>
        )}

        {payments.length > 0 && (
          <div className="payments-list">
            <h3>Found Payments</h3>
            {payments.map((p) => (
              <div key={p.index} className="payment-card">
                <div className="payment-info">
                  <span className="amount">{p.amount} {p.token}</span>
                  <code className="small">{p.stealthPubX.slice(0, 12)}...</code>
                </div>
                <button
                  className="withdraw-btn"
                  onClick={() => {
                    if (!wallet.isConnected) {
                      connectWallet();
                      return;
                    }
                    alert('Withdrawal flow coming in next update!');
                  }}
                >
                  Withdraw
                </button>
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
        <h2>How Scanning Works</h2>
        <div className="info-grid">
          <div className="info-item">
            <strong>Privacy Preserved</strong>
            <p>Scanning happens client-side. Your viewing key never leaves your browser.</p>
          </div>
          <div className="info-item">
            <strong>On-chain Events</strong>
            <p>We read StealthPayment records from the vault contract and try each with your viewing key.</p>
          </div>
          <div className="info-item">
            <strong>Withdraw Anywhere</strong>
            <p>Found a payment? Withdraw to any wallet. The link between sender and receiver stays hidden.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
