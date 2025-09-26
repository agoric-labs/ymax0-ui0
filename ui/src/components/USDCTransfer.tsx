import { useState } from 'react';
import { ethers } from 'ethers';

interface ChainConfig {
  name: string;
  rpcUrl: string;
  usdcAddress: string;
  chainId: number;
}

const CHAIN_CONFIGS: Record<string, ChainConfig> = {
  'base-sepolia': {
    name: 'Base Sepolia',
    rpcUrl: 'https://sepolia.base.org',
    usdcAddress: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    chainId: 84532,
  },
  'ethereum-sepolia': {
    name: 'Ethereum Sepolia',
    rpcUrl: 'https://sepolia.infura.io/v3/YOUR_INFURA_KEY',
    usdcAddress: '0xA0b86a33E6417c0Ff1e0c098b8C5D69D0fF06E1C',
    chainId: 11155111,
  },
  'arbitrum-sepolia': {
    name: 'Arbitrum Sepolia',
    rpcUrl: 'https://sepolia-rollup.arbitrum.io/rpc',
    usdcAddress: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',
    chainId: 421614,
  },
  'polygon-amoy': {
    name: 'Polygon Amoy',
    rpcUrl: 'https://rpc-amoy.polygon.technology',
    usdcAddress: '0x41e94eb019c0762f9bfcf9fb1e58725bfb0e7582',
    chainId: 80002,
  }
};

const USDC_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
];

export const USDCTransfer = () => {
  const [selectedChain, setSelectedChain] = useState('base-sepolia');
  const [receiverAddress, setReceiverAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [txHash, setTxHash] = useState('');
  const [error, setError] = useState('');
  const [balance, setBalance] = useState('');

  const checkBalance = async () => {
    if (!privateKey) {
      setError('Please enter your private key first');
      return;
    }

    try {
      setError('');
      const config = CHAIN_CONFIGS[selectedChain];
      const provider = new ethers.JsonRpcProvider(config.rpcUrl);
      const wallet = new ethers.Wallet(privateKey, provider);

      const usdcContract = new ethers.Contract(config.usdcAddress, USDC_ABI, provider);
      const balanceWei = await usdcContract.balanceOf(wallet.address);
      const decimals = await usdcContract.decimals();
      const formattedBalance = ethers.formatUnits(balanceWei, decimals);

      setBalance(formattedBalance);
    } catch (err) {
      setError(`Failed to check balance: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const transferUSDC = async () => {
    if (!privateKey) {
      setError('Please enter your private key');
      return;
    }

    if (!receiverAddress || !ethers.isAddress(receiverAddress)) {
      setError('Please enter a valid receiver address');
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    setLoading(true);
    setError('');
    setTxHash('');

    try {
      const config = CHAIN_CONFIGS[selectedChain];
      const provider = new ethers.JsonRpcProvider(config.rpcUrl);
      const wallet = new ethers.Wallet(privateKey, provider);

      console.log('Using wallet address:', wallet.address);
      console.log('Chain:', config.name);
      console.log('USDC Address:', config.usdcAddress);

      // Create USDC contract instance
      const usdcContract = new ethers.Contract(config.usdcAddress, USDC_ABI, wallet);

      // Get decimals and format amount
      const decimals = await usdcContract.decimals();
      const amountWei = ethers.parseUnits(amount, decimals);

      console.log('Transferring', amount, 'USDC to:', receiverAddress);
      console.log('Amount in wei:', amountWei.toString());

      // Execute transfer
      const tx = await usdcContract.transfer(receiverAddress, amountWei);
      console.log('Transaction hash:', tx.hash);
      setTxHash(tx.hash);

      // Wait for confirmation
      const receipt = await tx.wait();
      console.log('Transaction confirmed in block:', receipt.blockNumber);
      console.log('Gas used:', receipt.gasUsed.toString());

      // Refresh balance
      await checkBalance();

    } catch (err) {
      console.error('Transfer error:', err);
      setError(`Transfer failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="usdc-transfer-container">
      <div className="page-header">
        <h1>USDC Transfer</h1>
        <p>Send USDC between wallets on EVM chains</p>
      </div>

      <div className="transfer-form">
        <div className="form-section">
          <h3>Chain Selection</h3>
          <div className="input-group">
            <label htmlFor="chain-select">EVM Chain:</label>
            <select
              id="chain-select"
              value={selectedChain}
              onChange={(e) => setSelectedChain(e.target.value)}
              className="chain-selector"
            >
              {Object.entries(CHAIN_CONFIGS).map(([key, config]) => (
                <option key={key} value={key}>
                  {config.name}
                </option>
              ))}
            </select>
          </div>

          <div className="chain-info">
            <small>
              <strong>RPC:</strong> {CHAIN_CONFIGS[selectedChain].rpcUrl}<br />
              <strong>USDC Contract:</strong> {CHAIN_CONFIGS[selectedChain].usdcAddress}
            </small>
          </div>
        </div>

        <div className="form-section">
          <h3>Wallet Configuration</h3>
          <div className="input-group">
            <label htmlFor="private-key">Private Key:</label>
            <input
              id="private-key"
              type="password"
              value={privateKey}
              onChange={(e) => setPrivateKey(e.target.value)}
              placeholder="Enter your wallet private key"
              className="private-key-input"
            />
          </div>

          <div className="balance-section">
            <button
              type="button"
              onClick={checkBalance}
              className="check-balance-btn"
              disabled={!privateKey}
            >
              Check USDC Balance
            </button>
            {balance && (
              <div className="balance-display">
                <strong>Current Balance: {balance} USDC</strong>
              </div>
            )}
          </div>
        </div>

        <div className="form-section">
          <h3>Transfer Details</h3>
          <div className="input-group">
            <label htmlFor="receiver">Receiver Address:</label>
            <input
              id="receiver"
              type="text"
              value={receiverAddress}
              onChange={(e) => setReceiverAddress(e.target.value)}
              placeholder="0x..."
              className="address-input"
            />
          </div>

          <div className="input-group">
            <label htmlFor="amount">Amount (USDC):</label>
            <input
              id="amount"
              type="number"
              step="0.000001"
              min="0.000001"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter amount to transfer"
              className="amount-input"
            />
          </div>
        </div>

        <div className="form-actions">
          <button
            onClick={transferUSDC}
            disabled={loading || !privateKey || !receiverAddress || !amount}
            className="transfer-btn"
          >
            {loading ? 'Transferring...' : 'Transfer USDC'}
          </button>
        </div>

        {error && (
          <div className="error-message">
            <strong>Error:</strong> {error}
          </div>
        )}

        {txHash && (
          <div className="success-message">
            <strong>Success!</strong>
            <br />
            Transaction Hash:
            <a
              href={`https://sepolia.basescan.org/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="tx-link"
            >
              {txHash}
            </a>
          </div>
        )}
      </div>

      <div className="security-warning">
        <h4>⚠️ Security Warning</h4>
        <p>
          This is a development tool. Never use this with mainnet funds or share your private key.
          Consider using environment variables or a secure key management solution in production.
        </p>
      </div>
    </div>
  );
};