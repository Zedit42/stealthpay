import { useState } from 'react';
import { useParams } from 'react-router-dom';
import type { WalletState } from '../App';

interface Props {
  wallet: WalletState;
}

export default function Pay({ wallet }: Props) {
  const { metaAddress } = useParams();
  const [amount, setAmount] = useState('');
  const [token, setToken] = useState('ETH');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');

  const sendPayment = async () => {
    if (!wallet.isConnected) {
      alert('Connect your wallet first');
      return;
    }
    setStatus('sending');
    // TODO: Integrate with SDK
    // 1. Fetch meta-address from registry (or decode from URL)
    // 2. deriveStealthAddress(metaAddress)
    // 3. Call stealth_vault.send_to_stealth()
    setTimeout(() => setStatus('sent'), 2000); // placeholder
  };

  return (
    <div className="page">
      <div className="card">
        <h2>Send Private Payment</h2>
        <p className="recipient">
          To: <code>{metaAddress?.slice(0, 10)}...{metaAddress?.slice(-8)}</code>
        </p>

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
          />
        </div>

        {status === 'idle' && (
          <button onClick={sendPayment} className="primary-btn" disabled={!amount}>
            Send Payment
          </button>
        )}
        {status === 'sending' && <p className="status">⏳ Generating stealth address & sending...</p>}
        {status === 'sent' && (
          <div className="success">
            <p>✅ Payment sent privately!</p>
            <p className="note">The recipient's real address is never revealed on-chain.</p>
          </div>
        )}
      </div>
    </div>
  );
}
