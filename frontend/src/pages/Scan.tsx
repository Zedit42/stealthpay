import { useState } from 'react';
import type { WalletState } from '../App';

interface Payment {
  index: number;
  amount: string;
  token: string;
  timestamp: string;
}

interface Props {
  wallet: WalletState;
}

export default function Scan({ wallet }: Props) {
  const [scanning, setScanning] = useState(false);
  const [payments, setPayments] = useState<Payment[]>([]);

  const scanForPayments = async () => {
    if (!wallet.isConnected) {
      alert('Connect your wallet first');
      return;
    }
    setScanning(true);
    // TODO: Integrate with SDK
    // 1. Get viewing key from local storage / keystore
    // 2. Fetch all StealthPayment events from vault contract
    // 3. scanPayments(viewingKey, spendingPubKey, ephemeralKeys, stealthAddrs)
    // 4. Display matching payments
    setTimeout(() => {
      setPayments([]); // placeholder
      setScanning(false);
    }, 2000);
  };

  return (
    <div className="page">
      <div className="card">
        <h2>Scan for Payments</h2>
        <p>Scan the blockchain for payments sent to your stealth addresses.</p>
        <button onClick={scanForPayments} className="primary-btn" disabled={scanning}>
          {scanning ? '🔍 Scanning...' : '🔍 Scan Payments'}
        </button>

        {payments.length > 0 ? (
          <div className="payments-list">
            {payments.map((p) => (
              <div key={p.index} className="payment-item">
                <span>{p.amount} {p.token}</span>
                <span>{p.timestamp}</span>
                <button className="withdraw-btn">Withdraw</button>
              </div>
            ))}
          </div>
        ) : (
          !scanning && <p className="empty">No payments found yet. Share your payment link!</p>
        )}
      </div>
    </div>
  );
}
