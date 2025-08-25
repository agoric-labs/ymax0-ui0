import { stringifyAmountValue } from '@agoric/ui-components';
import { useState } from 'react';
import { YieldProtocol, EVMChain } from '../ymax-client';

type TradeProps = {
  makeOffer: (
    usdcAmount: bigint,
    bldFeeAmount: bigint,
    yieldProtocol: YieldProtocol,
    evmChain?: EVMChain,
  ) => void;
  withdrawUSDC: () => void;
  openEmptyPortfolio: () => void;
  istPurse: Purse;
  walletConnected: boolean;
  offerId?: number;
  usdcPurse?: Purse;
  bldPurse?: Purse;
  poc26Purse?: Purse;
};

// Simplified Trade component with customizable USDC and BLD fee amounts
const Trade = ({
  makeOffer,
  withdrawUSDC,
  openEmptyPortfolio,
  walletConnected,
  offerId,
  usdcPurse,
  bldPurse,
  poc26Purse,
}: TradeProps) => {
  // Default to 1.25 USDC and 20 BLD
  const [usdcAmount, setUsdcAmount] = useState<string>('1.25');
  const [bldFeeAmount, setBldFeeAmount] = useState<string>('20');
  const [yieldProtocol, setYieldProtocol] = useState<YieldProtocol>('Aave');
  const [evmChain, setEvmChain] = useState<EVMChain>('Avalanche');

  // Handle making an offer
  const handleMakeOffer = () => {
    // Convert USDC amount to bigint (USDC has 6 decimal places)
    const usdcValue = BigInt(Math.floor(parseFloat(usdcAmount) * 1_000_000));

    // Convert BLD fee amount to bigint (BLD has 6 decimal places)
    // For USDN protocol, no fee is required, so pass 0
    const bldValue =
      yieldProtocol === 'USDN'
        ? 0n
        : BigInt(Math.floor(parseFloat(bldFeeAmount) * 1_000_000));

    // Only pass the EVM chain if Aave or Compound is selected
    const evmChainParam =
      yieldProtocol === 'Aave' || yieldProtocol === 'Compound'
        ? evmChain
        : undefined;

    makeOffer(usdcValue, bldValue, yieldProtocol, evmChainParam);
  };

  // Handle withdrawing USDC
  const handleWithdraw = () => {
    withdrawUSDC();
  };

  // Handle opening an empty portfolio
  const handleOpenEmptyPortfolio = () => {
    openEmptyPortfolio();
  };

  return (
    <div className="trade-container">
      <div className="page-header">
        <h1>ymax-dev-ui</h1>
      </div>

      <div className="options-container">
        <div className="option-card">
          <h4>Option 1: Make Offer with USDC</h4>

          <div className="input-row">
            <div className="input-group">
              <label htmlFor="usdc-amount">USDC Amount:</label>
              <input
                id="usdc-amount"
                type="number"
                step="0.01"
                min="0.01"
                value={usdcAmount}
                onChange={e => setUsdcAmount(e.target.value)}
                placeholder="Enter USDC amount"
              />
            </div>

            <div className="input-group">
              <label htmlFor="bld-fee">BLD Fee Amount:</label>
              <input
                id="bld-fee"
                type="number"
                step="1"
                min="1"
                value={bldFeeAmount}
                onChange={e => setBldFeeAmount(e.target.value)}
                placeholder="Enter BLD fee amount"
                disabled={yieldProtocol === 'USDN'}
              />
              {yieldProtocol === 'USDN' && (
                <small className="fee-info">
                  No fee required for USDN protocol
                </small>
              )}
            </div>
          </div>

          <div className="input-group position-select">
            <label>Yield Protocol:</label>
            <div className="radio-group">
              <label className="radio-label">
                <input
                  type="radio"
                  name="yieldProtocol"
                  value="USDN"
                  checked={yieldProtocol === 'USDN'}
                  onChange={() => setYieldProtocol('USDN')}
                />
                USDN
              </label>
              <label className="radio-label">
                <input
                  type="radio"
                  name="yieldProtocol"
                  value="Aave"
                  checked={yieldProtocol === 'Aave'}
                  onChange={() => setYieldProtocol('Aave')}
                />
                Aave
              </label>
              <label className="radio-label">
                <input
                  type="radio"
                  name="yieldProtocol"
                  value="Compound"
                  checked={yieldProtocol === 'Compound'}
                  onChange={() => setYieldProtocol('Compound')}
                />
                Compound
              </label>
            </div>
          </div>

          {/* EVM Chain Selector - only visible when Aave or Compound is selected */}
          {(yieldProtocol === 'Aave' || yieldProtocol === 'Compound') && (
            <div className="chain-select">
              <label htmlFor="evm-chain">EVM Chain:</label>
              <select
                id="evm-chain"
                value={evmChain}
                onChange={e => setEvmChain(e.target.value as EVMChain)}
                className="chain-selector"
              >
                <option value="Avalanche">Avalanche</option>
                <option value="Arbitrum">Arbitrum</option>
                <option value="Ethereum">Ethereum</option>
              </select>
            </div>
          )}

          <div className="balance-display">
            <h5 style={{ marginBottom: '10px', color: '#333' }}>Current Balances:</h5>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '15px' }}>
              <div style={{ padding: '8px', backgroundColor: '#f8f9fa', borderRadius: '4px', textAlign: 'center' }}>
                <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>USDC</div>
                <div style={{ fontWeight: 'bold', color: '#0066cc' }}>
                  {usdcPurse 
                    ? stringifyAmountValue(
                        usdcPurse.currentAmount,
                        usdcPurse.displayInfo.assetKind,
                        usdcPurse.displayInfo.decimalPlaces,
                      )
                    : 'Loading...'
                  }
                </div>
              </div>
              <div style={{ padding: '8px', backgroundColor: '#f8f9fa', borderRadius: '4px', textAlign: 'center' }}>
                <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>BLD</div>
                <div style={{ fontWeight: 'bold', color: '#dc3545' }}>
                  {bldPurse 
                    ? stringifyAmountValue(
                        bldPurse.currentAmount,
                        bldPurse.displayInfo.assetKind,
                        bldPurse.displayInfo.decimalPlaces,
                      )
                    : 'Loading...'
                  }
                </div>
              </div>
              <div style={{ padding: '8px', backgroundColor: '#f8f9fa', borderRadius: '4px', textAlign: 'center' }}>
                <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>PoC26</div>
                <div style={{ fontWeight: 'bold', color: '#28a745' }}>
                  {poc26Purse 
                    ? stringifyAmountValue(
                        poc26Purse.currentAmount,
                        poc26Purse.displayInfo.assetKind,
                        poc26Purse.displayInfo.decimalPlaces,
                      )
                    : 'Loading...'
                  }
                </div>
              </div>
            </div>
          </div>
          <div className="info-section">
            <p>
              The offer is configured to only include the "give" part without a
              "want" part.
            </p>
            {/* <p>
              After locking funds, you can withdraw using the withdraw button.
            </p> */}
          </div>
        </div>

        <div className="option-card">
          <h4>Option 2: Open Empty Portfolio</h4>
          <div className="info-section">
            <p>
              This option will open a new portfolio without requiring any USDC
              deposit.
            </p>
            <p>
              Use this if you just want to create a portfolio without opening a
              position.
            </p>
          </div>
        </div>
      </div>

      <div className="offer-actions">
        {walletConnected ? (
          <div className="button-group">
            <button onClick={handleMakeOffer}>Open Position</button>

            <button
              onClick={handleOpenEmptyPortfolio}
              className="empty-portfolio-button"
            >
              Open Empty Portfolio
            </button>

            {offerId && (
              <button onClick={handleWithdraw} className="withdraw-button">
                Withdraw USDC
              </button>
            )}
          </div>
        ) : (
          <p>Please connect your wallet to make an offer.</p>
        )}
      </div>
    </div>
  );
};

export { Trade };
