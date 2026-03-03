import { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import type { WalletState } from '../App';
import { deriveStealthAddress } from '../crypto/stealth';

interface Props {
  wallet: WalletState;
}

export default function Pay(_props: Props) {
  const { metaAddress } = useParams();
  const [amount, setAmount] = useState('');
  const [token, setToken] = useState('ETH');
  const [status, setStatus] = useState<'idle' | 'deriving' | 'sending' | 'sent'>('idle');
  const [txDetails, setTxDetails] = useState<{
    stealthPubX: string; stealthPubY: string;
    ephemeralPubX: string; ephemeralPubY: string;
  } | null>(null);

  // Decode meta-address from URL
  const metaKeys = useMemo(() => {
    if (!metaAddress) return null;
    try {
      const decoded = atob(metaAddress);
      const [spx, spy, vpx, vpy] = decoded.split(',');
      return { spendingPubX: spx, spendingPubY: spy, viewingPubX: vpx, viewingPubY: vpy };
    } catch {
      return null;
    }
  }, [metaAddress]);

  const sendPayment = async () => {
    if (!metaKeys) return;

    setStatus('deriving');

    // Derive stealth address
    const result = deriveStealthAddress(
      BigInt(metaKeys.spendingPubX),
      BigInt(metaKeys.spendingPubY),
      BigInt(metaKeys.viewingPubX),
      BigInt(metaKeys.viewingPubY),
    );

    setTxDetails(result);
    setStatus('sending');

    // In production: call stealth_vault.send_to_stealth() via starknet.js
    // For hackathon demo, we show the derived address
    setTimeout(() => setStatus('sent'), 1500);
  };

  if (!metaKeys) {
    return (
      <div className="page">
        <div className="card error-card">
          <h2>⚠️ Invalid Payment Link</h2>
          <p>This payment link is malformed. Ask the recipient for a new one.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="card">
        <h2>🥷 Send Private Payment</h2>
        <p className="subtitle">The recipient's real address will never appear on-chain.</p>

        <div className="recipient-info">
          <span className="label">Recipient Meta-Address</span>
          <code>{metaKeys.spendingPubX.slice(0, 12)}...{metaKeys.viewingPubY.slice(-8)}</code>
        </div>

        <div className="form-group">
          <label>Token</label>
          <select value={token} onChange={(e) => setToken(e.target.value)}>
            <option value="ETH">ETH</option>
            <option value="STRK">STRK</option>
            <option value="USDC">USDC</option>
          </select>
        </div>

        <div className="form-group">
          <label>Amount</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.0"
            step="0.001"
          />
        </div>

        {status === 'idle' && (
          <button onClick={sendPayment} className="primary-btn" disabled={!amount || parseFloat(amount) <= 0}>
            🔒 Send Privately
          </button>
        )}

        {status === 'deriving' && (
          <div className="status-box">
            <div className="spinner" />
            <p>Deriving stealth address...</p>
          </div>
        )}

        {status === 'sending' && (
          <div className="status-box">
            <div className="spinner" />
            <p>Sending {amount} {token} to stealth address...</p>
          </div>
        )}

        {status === 'sent' && txDetails && (
          <div className="success-box">
            <h3>✅ Payment Sent!</h3>
            <div className="tx-details">
              <div className="detail">
                <span className="label">Stealth Address</span>
                <code>{txDetails.stealthPubX.slice(0, 16)}...</code>
              </div>
              <div className="detail">
                <span className="label">Ephemeral Key</span>
                <code>{txDetails.ephemeralPubX.slice(0, 16)}...</code>
              </div>
              <div className="detail">
                <span className="label">Amount</span>
                <span>{amount} {token}</span>
              </div>
            </div>
            <p className="note">
              The recipient will detect this payment by scanning the ephemeral key with their viewing key. Your identity is not linked to this payment.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
