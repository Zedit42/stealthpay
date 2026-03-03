import { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import type { WalletState } from '../App';
import { deriveStealthAddress } from '../crypto/stealth';
// starknet imports available for contract interaction

const VAULT_ADDRESS = '0x07efc6272b3b1db522e63c114ef07d52cd1c0902d1102d3d0b5118c9a30c83d2';

const TOKEN_ADDRESSES: Record<string, string> = {
  ETH: '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7',
  STRK: '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d',
};

interface Props {
  wallet: WalletState;
  connectWallet: () => Promise<void>;
}

export default function Pay({ wallet, connectWallet }: Props) {
  const { metaAddress } = useParams();
  const [amount, setAmount] = useState('');
  const [token, setToken] = useState('ETH');
  const [status, setStatus] = useState<'idle' | 'deriving' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState('');
  const [txDetails, setTxDetails] = useState<{
    stealthPubX: string; stealthPubY: string;
    ephemeralPubX: string; ephemeralPubY: string;
    txHash?: string;
  } | null>(null);

  const metaKeys = useMemo(() => {
    if (!metaAddress) return null;
    try {
      let b64 = metaAddress.replace(/-/g, '+').replace(/_/g, '/');
      while (b64.length % 4) b64 += '=';
      const decoded = atob(b64);
      const [spx, spy, vpx, vpy] = decoded.split(',');
      if (!spx || !spy || !vpx || !vpy) return null;
      return { spendingPubX: spx, spendingPubY: spy, viewingPubX: vpx, viewingPubY: vpy };
    } catch {
      return null;
    }
  }, [metaAddress]);

  const sendPayment = async () => {
    if (!metaKeys || !amount || parseFloat(amount) <= 0) return;

    if (!wallet.isConnected) {
      await connectWallet();
      return;
    }

    setStatus('deriving');
    setError('');

    try {
      // 1. Derive stealth address
      const result = deriveStealthAddress(
        BigInt(metaKeys.spendingPubX),
        BigInt(metaKeys.spendingPubY),
        BigInt(metaKeys.viewingPubX),
        BigInt(metaKeys.viewingPubY),
      );

      setTxDetails(result);
      setStatus('sending');

      // 2. Call vault contract via wallet
      const win = window as any;
      const starknetWallet = win.starknet_argentX || win.starknet_braavos || win.starknet;

      if (!starknetWallet?.account) {
        throw new Error('Wallet not connected');
      }

      const tokenAddress = TOKEN_ADDRESSES[token] || TOKEN_ADDRESSES.ETH;
      const amountWei = BigInt(Math.floor(parseFloat(amount) * 1e18));

      // Multicall: approve vault + send_to_stealth
      const txResult = await starknetWallet.account.execute([
        {
          contractAddress: tokenAddress,
          entrypoint: 'approve',
          calldata: [VAULT_ADDRESS, amountWei.toString(), '0'],
        },
        {
          contractAddress: VAULT_ADDRESS,
          entrypoint: 'send_to_stealth',
          calldata: [
            result.stealthPubX,
            result.stealthPubY,
            result.ephemeralPubX,
            result.ephemeralPubY,
            tokenAddress,
            amountWei.toString(),
            '0',
          ],
        },
      ]);

      setTxDetails({ ...result, txHash: txResult.transaction_hash });
      setStatus('sent');
    } catch (err: any) {
      console.error('Payment failed:', err);
      setError(err.message || 'Payment failed');
      setStatus('error');
    }
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
        <h2>Send Private Payment</h2>
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
          <button
            onClick={sendPayment}
            className="primary-btn"
            disabled={!amount || parseFloat(amount) <= 0}
          >
            {wallet.isConnected ? 'Send Privately' : 'Connect Wallet & Send'}
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
            <p>Confirm transaction in your wallet...</p>
            <p className="note">Sending {amount} {token} to stealth address</p>
          </div>
        )}

        {status === 'error' && (
          <div className="error-box">
            <h3>❌ Payment Failed</h3>
            <p>{error}</p>
            <button onClick={() => setStatus('idle')} className="secondary-btn">
              Try Again
            </button>
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
              {txDetails.txHash && (
                <div className="detail">
                  <span className="label">Transaction</span>
                  <a
                    href={`https://sepolia.voyager.online/tx/${txDetails.txHash}`}
                    target="_blank"
                    rel="noopener"
                    className="tx-link"
                  >
                    {txDetails.txHash.slice(0, 16)}... ↗
                  </a>
                </div>
              )}
            </div>
            <p className="note">
              The recipient will detect this payment by scanning with their viewing key.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
