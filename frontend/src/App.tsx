import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { useState } from 'react';
import { connect } from 'get-starknet-core';
import Home from './pages/Home';
import Pay from './pages/Pay';
import Scan from './pages/Scan';
import Dashboard from './pages/Dashboard';
import './App.css';

export interface WalletState {
  address: string;
  isConnected: boolean;
}

function App() {
  const [wallet, setWallet] = useState<WalletState>({
    address: '',
    isConnected: false,
  });

  const connectWallet = async () => {
    try {
      const starknet = await connect({ modalMode: 'alwaysAsk' });
      if (starknet) {
        await starknet.enable();
        if (starknet.selectedAddress) {
          setWallet({
            address: starknet.selectedAddress,
            isConnected: true,
          });
        }
      }
    } catch (err) {
      console.error('Wallet connection failed:', err);
    }
  };

  return (
    <BrowserRouter>
      <div className="app">
        <nav className="navbar">
          <Link to="/" className="logo">
            🥷 StealthPay
          </Link>
          <div className="nav-links">
            <Link to="/scan">Scan</Link>
            <Link to="/dashboard">Dashboard</Link>
            {wallet.isConnected ? (
              <span className="wallet-addr">
                {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}
              </span>
            ) : (
              <button onClick={connectWallet} className="connect-btn">
                Connect Wallet
              </button>
            )}
          </div>
        </nav>

        <main>
          <Routes>
            <Route path="/" element={<Home wallet={wallet} />} />
            <Route path="/pay/:metaAddress" element={<Pay wallet={wallet} />} />
            <Route path="/scan" element={<Scan wallet={wallet} />} />
            <Route path="/dashboard" element={<Dashboard wallet={wallet} />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
