import { useState } from 'react';
import type { WalletState } from '../App';
import { useStealthKeys } from '../hooks/useStealthKeys';

interface DetectedPayment {
  index: number;
  amount: string;
  token: string;
  stealthPubX: string;
  ephPubX: string;
}

interface Props {
  wallet: WalletState;
}

export default function Scan(_props: Props) {
  const { keys, hasKeys } = useStealthKeys();
  const [scanning, setScanning] = useState(false);
  const [payments, setPayments] = useState<DetectedPayment[]>([]);
  const [scanned, setScanned] = useState(false);

  const scanForPayments = async () => {
    if (!hasKeys || !keys) return;
    setScanning(true);

    // In production:
    // 1. Fetch all StealthPayment events from vault contract
    // 2. For each event, try to match with viewing key
    // 3. Return matching payments

    // Demo: simulate scan
    await new Promise(r => setTimeout(r, 2000));

    // For hackathon demo — in real app this would scan on-chain events
    setPayments([]);
    setScanning(false);
    setScanned(true);
  };

  if (!hasKeys) {
    return (
      <div className="page">
        <div className="card">
          <h2>🔍 Scan for Payments</h2>
          <p>You need to generate stealth keys first.</p>
          <a href="/" className="primary-btn inline-link">Go to Home</a>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="card">
        <h2>🔍 Scan for Payments</h2>
        <p>
          Scan the blockchain for payments sent to your stealth addresses.
          Only your viewing key can detect these payments.
        </p>

        <div className="key-info">
          <span className="badge">🔑 Viewing Key Active</span>
          <code className="small">{keys!.viewingPubX.slice(0, 16)}...</code>
        </div>

        <button
          onClick={scanForPayments}
          className="primary-btn"
          disabled={scanning}
        >
          {scanning ? (
            <>
              <span className="spinner-inline" /> Scanning blocks...
            </>
          ) : (
            '🔍 Scan Payments'
          )}
        </button>

        {payments.length > 0 && (
          <div className="payments-list">
            <h3>Found Payments</h3>
            {payments.map((p) => (
              <div key={p.index} className="payment-card">
                <div className="payment-info">
                  <span className="amount">{p.amount} {p.token}</span>
                  <code className="small">{p.stealthPubX.slice(0, 12)}...</code>
                </div>
                <button className="withdraw-btn">
                  💸 Withdraw
                </button>
              </div>
            ))}
          </div>
        )}

        {scanned && payments.length === 0 && (
          <div className="empty-state">
            <p>📭 No payments found</p>
            <p className="note">Share your payment link to receive private payments!</p>
          </div>
        )}
      </div>

      <div className="card">
        <h2>How Scanning Works</h2>
        <div className="info-grid">
          <div className="info-item">
            <strong>🔒 Privacy Preserved</strong>
            <p>Scanning happens client-side. Your viewing key never leaves your browser.</p>
          </div>
          <div className="info-item">
            <strong>🔗 On-chain Events</strong>
            <p>We scan StealthPayment events and try each ephemeral key with your viewing key.</p>
          </div>
          <div className="info-item">
            <strong>💸 Withdraw Anywhere</strong>
            <p>Found a payment? Withdraw to any wallet. The link between sender and receiver stays hidden.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
