import { stringifyAmountValue } from '@agoric/ui-components';
import { useState, useEffect } from 'react';
import { YieldProtocol, EVMChain } from '../ymax-client';
import { StepSelector, StepInfo } from './StepSelector';
import { generateOpenPositionSteps, generateWithdrawSteps } from '../utils/stepUtils';
import { getLatestOpenPortfolioOfferId, testVstoragePath } from '../utils/walletUtils';

type TradeProps = {
  makeOffer: (
    usdcAmount: bigint,
    bldFeeAmount: bigint,
    yieldProtocol: YieldProtocol,
    evmChain?: EVMChain,
    selectedSteps?: string[],
  ) => void;
  withdrawUSDC: () => void;
  withdrawFromProtocol: (
    withdrawAmount: bigint,
    fromProtocol: YieldProtocol,
    evmChain?: EVMChain,
    prevOfferId?: string,
    selectedSteps?: string[],
  ) => void;
  openEmptyPortfolio: () => void;
  acceptInvitation: () => void;
  settleTransaction: (
    txId: string,
    status: string,
    prevOfferId: string,
  ) => void;
  istPurse: Purse;
  walletConnected: boolean;
  offerId?: number;
  usdcPurse?: Purse;
  bldPurse?: Purse;
  poc26Purse?: Purse;
  walletAddress?: string;
  watcher?: any;
};

// Simplified Trade component with customizable USDC and BLD fee amounts
const Trade = ({
  makeOffer,
  withdrawUSDC,
  withdrawFromProtocol,
  openEmptyPortfolio,
  acceptInvitation,
  settleTransaction,
  walletConnected,
  offerId,
  usdcPurse,
  bldPurse,
  poc26Purse,
  walletAddress,
  watcher,
}: TradeProps) => {
  // Default to 1.25 USDC and 20 BLD
  const [usdcAmount, setUsdcAmount] = useState<string>('1.25');
  const [bldFeeAmount, setBldFeeAmount] = useState<string>('20');
  const [yieldProtocol, setYieldProtocol] = useState<YieldProtocol>('Aave');
  const [evmChain, setEvmChain] = useState<EVMChain>('Avalanche');

  // Settle transaction form state
  const [txId, setTxId] = useState<string>('');
  const [txStatus, setTxStatus] = useState<string>('success');
  const [prevOfferId, setPrevOfferId] = useState<string>(
    'redeem-2025-09-17T09:19:35.351Z',
  );

  // Withdraw form state
  const [withdrawAmount, setWithdrawAmount] = useState<string>('0.5');
  const [withdrawFromProtocolState, setWithdrawFromProtocolState] =
    useState<YieldProtocol>('Aave');
  const [withdrawEvmChain, setWithdrawEvmChain] =
    useState<EVMChain>('Avalanche');
  const [withdrawPrevOfferId, setWithdrawPrevOfferId] = useState<string>(
    'open-2025-09-19T09:25:20.918Z',
  );

  // Step selection state
  const [openPositionSelectedSteps, setOpenPositionSelectedSteps] = useState<string[]>([]);
  const [withdrawSelectedSteps, setWithdrawSelectedSteps] = useState<string[]>([]);

  // Auto-fetched offer ID state
  const [isLoadingOfferId, setIsLoadingOfferId] = useState(false);
  const [autoFetchedOfferId, setAutoFetchedOfferId] = useState<string | null>(null);

  // Fetch latest offer ID when wallet is connected
  useEffect(() => {
    const fetchLatestOfferId = async () => {
      if (walletConnected && walletAddress && watcher && !isLoadingOfferId) {
        setIsLoadingOfferId(true);
        try {
          console.log('Fetching latest offer ID for wallet:', walletAddress);
          const latestOfferId = await getLatestOpenPortfolioOfferId(watcher, walletAddress);
          console.log('Fetched offer ID:', latestOfferId);
          if (latestOfferId) {
            setAutoFetchedOfferId(latestOfferId);
            setWithdrawPrevOfferId(latestOfferId);
          } else {
            console.log('No openPortfolio offers found for this wallet');
          }
        } catch (error) {
          console.error('Failed to fetch latest offer ID:', error);
        } finally {
          setIsLoadingOfferId(false);
        }
      }
    };

    // Add a small delay to ensure wallet connection is fully established
    const timeoutId = setTimeout(fetchLatestOfferId, 1000);
    return () => clearTimeout(timeoutId);
  }, [walletConnected, walletAddress, watcher, isLoadingOfferId]);

  // Manual refresh function
  const handleRefreshOfferId = async () => {
    if (walletConnected && walletAddress && watcher && !isLoadingOfferId) {
      setIsLoadingOfferId(true);
      try {
        const latestOfferId = await getLatestOpenPortfolioOfferId(watcher, walletAddress);
        if (latestOfferId) {
          setAutoFetchedOfferId(latestOfferId);
          setWithdrawPrevOfferId(latestOfferId);
        }
      } catch (error) {
        console.error('Failed to refresh offer ID:', error);
        alert('Failed to fetch latest offer ID. Please check console for details.');
      } finally {
        setIsLoadingOfferId(false);
      }
    }
  };

  // Handle making an offer
  const handleMakeOffer = () => {
    // Convert USDC amount to bigint (USDC has 6 decimal places)
    const usdcValue = BigInt(
      Math.floor(parseFloat(usdcAmount.trim()) * 1_000_000),
    );

    // Convert BLD fee amount to bigint (BLD has 6 decimal places)
    // For USDN protocol, no fee is required, so pass 0
    const bldValue =
      yieldProtocol === 'USDN'
        ? 0n
        : BigInt(Math.floor(parseFloat(bldFeeAmount.trim()) * 1_000_000));

    // Only pass the EVM chain if Aave or Compound is selected
    const evmChainParam =
      yieldProtocol === 'Aave' || yieldProtocol === 'Compound'
        ? evmChain
        : undefined;

    makeOffer(usdcValue, bldValue, yieldProtocol, evmChainParam, openPositionSelectedSteps);
  };

  // Handle withdrawing USDC
  const handleWithdraw = () => {
    withdrawUSDC();
  };

  // Handle opening an empty portfolio
  const handleOpenEmptyPortfolio = () => {
    openEmptyPortfolio();
  };

  // Handle accepting invitation
  const handleAcceptInvitation = () => {
    acceptInvitation();
  };

  // Handle settle transaction
  const handleSettleTransaction = () => {
    settleTransaction(txId.trim(), txStatus, prevOfferId.trim());
  };

  // Handle protocol-specific withdraw
  const handleWithdrawFromProtocol = () => {
    // Convert withdraw amount to bigint (USDC has 6 decimal places)
    const withdrawValue = BigInt(
      Math.floor(parseFloat(withdrawAmount.trim()) * 1_000_000),
    );

    // Only pass the EVM chain if Aave or Compound is selected
    const evmChainParam =
      withdrawFromProtocolState === 'Aave' ||
      withdrawFromProtocolState === 'Compound'
        ? withdrawEvmChain
        : undefined;

    withdrawFromProtocol(
      withdrawValue,
      withdrawFromProtocolState,
      evmChainParam,
      withdrawPrevOfferId.trim(),
      withdrawSelectedSteps,
    );
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
                <option value="Base">Base</option>
              </select>
            </div>
          )}

          <div className="balance-display">
            <h5 style={{ marginBottom: '10px', color: '#333' }}>
              Current Balances:
            </h5>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: '10px',
                marginBottom: '15px',
              }}
            >
              <div
                style={{
                  padding: '8px',
                  backgroundColor: '#f8f9fa',
                  borderRadius: '4px',
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    fontSize: '12px',
                    color: '#666',
                    marginBottom: '4px',
                  }}
                >
                  USDC
                </div>
                <div style={{ fontWeight: 'bold', color: '#0066cc' }}>
                  {usdcPurse
                    ? stringifyAmountValue(
                        usdcPurse.currentAmount,
                        usdcPurse.displayInfo.assetKind,
                        usdcPurse.displayInfo.decimalPlaces,
                      )
                    : 'Loading...'}
                </div>
              </div>
              <div
                style={{
                  padding: '8px',
                  backgroundColor: '#f8f9fa',
                  borderRadius: '4px',
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    fontSize: '12px',
                    color: '#666',
                    marginBottom: '4px',
                  }}
                >
                  BLD
                </div>
                <div style={{ fontWeight: 'bold', color: '#dc3545' }}>
                  {bldPurse
                    ? stringifyAmountValue(
                        bldPurse.currentAmount,
                        bldPurse.displayInfo.assetKind,
                        bldPurse.displayInfo.decimalPlaces,
                      )
                    : 'Loading...'}
                </div>
              </div>
              <div
                style={{
                  padding: '8px',
                  backgroundColor: '#f8f9fa',
                  borderRadius: '4px',
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    fontSize: '12px',
                    color: '#666',
                    marginBottom: '4px',
                  }}
                >
                  PoC26
                </div>
                <div style={{ fontWeight: 'bold', color: '#28a745' }}>
                  {poc26Purse
                    ? stringifyAmountValue(
                        poc26Purse.currentAmount,
                        poc26Purse.displayInfo.assetKind,
                        poc26Purse.displayInfo.decimalPlaces,
                      )
                    : 'Loading...'}
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
          
          <StepSelector
            title="Show Steps"
            steps={generateOpenPositionSteps(
              yieldProtocol,
              evmChain,
              BigInt(Math.floor(parseFloat(usdcAmount.trim()) * 1_000_000))
            )}
            onSelectionChange={setOpenPositionSelectedSteps}
            className="open-position-steps"
          />
        </div>

        <div className="option-card">
          <h4>Option 2: Withdraw from Protocol</h4>

          <div className="input-row">
            <div className="input-group">
              <label htmlFor="withdraw-amount">Withdraw Amount (USDC):</label>
              <input
                id="withdraw-amount"
                type="number"
                step="0.01"
                min="0.01"
                value={withdrawAmount}
                onChange={e => setWithdrawAmount(e.target.value)}
                placeholder="Enter amount to withdraw"
              />
            </div>
          </div>

          <div className="input-row">
            <div className="input-group">
              <label htmlFor="withdraw-prev-offer-id">
                Previous Offer ID:
                {isLoadingOfferId && (
                  <span className="loading-indicator"> (Loading...)</span>
                )}
                {autoFetchedOfferId && !isLoadingOfferId && (
                  <span className="auto-fetched-indicator"> (Auto-fetched)</span>
                )}
              </label>
              <div className="input-with-button">
                <input
                  id="withdraw-prev-offer-id"
                  type="text"
                  value={withdrawPrevOfferId}
                  onChange={e => setWithdrawPrevOfferId(e.target.value)}
                  placeholder={
                    isLoadingOfferId 
                      ? "Fetching latest offer ID..." 
                      : "Enter previous offer ID"
                  }
                  disabled={isLoadingOfferId}
                />
                {walletConnected && (
                  <>
                    <button
                      type="button"
                      onClick={handleRefreshOfferId}
                      disabled={isLoadingOfferId}
                      className="refresh-offer-button"
                      title="Refresh latest offer ID from blockchain"
                    >
                      {isLoadingOfferId ? '⟳' : '🔄'}
                    </button>
                    <button
                      type="button"
                      onClick={() => walletAddress && watcher && testVstoragePath(watcher, walletAddress)}
                      className="refresh-offer-button"
                      title="Test vstorage path"
                      style={{ marginLeft: '4px' }}
                    >
                      🔧
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="input-group position-select">
            <label>Withdraw From Protocol:</label>
            <div className="radio-group">
              <label className="radio-label">
                <input
                  type="radio"
                  name="withdrawProtocol"
                  value="USDN"
                  checked={withdrawFromProtocolState === 'USDN'}
                  onChange={() => setWithdrawFromProtocolState('USDN')}
                />
                USDN
              </label>
              <label className="radio-label">
                <input
                  type="radio"
                  name="withdrawProtocol"
                  value="Aave"
                  checked={withdrawFromProtocolState === 'Aave'}
                  onChange={() => setWithdrawFromProtocolState('Aave')}
                />
                Aave
              </label>
              <label className="radio-label">
                <input
                  type="radio"
                  name="withdrawProtocol"
                  value="Compound"
                  checked={withdrawFromProtocolState === 'Compound'}
                  onChange={() => setWithdrawFromProtocolState('Compound')}
                />
                Compound
              </label>
            </div>
          </div>

          {/* EVM Chain Selector for withdraw - only visible when Aave or Compound is selected */}
          {(withdrawFromProtocolState === 'Aave' ||
            withdrawFromProtocolState === 'Compound') && (
            <div className="chain-select">
              <label htmlFor="withdraw-evm-chain">EVM Chain:</label>
              <select
                id="withdraw-evm-chain"
                value={withdrawEvmChain}
                onChange={e => setWithdrawEvmChain(e.target.value as EVMChain)}
                className="chain-selector"
              >
                <option value="Avalanche">Avalanche</option>
                <option value="Arbitrum">Arbitrum</option>
                <option value="Ethereum">Ethereum</option>
                <option value="Base">Base</option>
              </select>
            </div>
          )}

          <div className="info-section">
            <p>
              This will withdraw the specified amount from your selected
              protocol position back to your USDC balance.
            </p>
          </div>

          <StepSelector
            title="Show Steps"
            steps={generateWithdrawSteps(
              withdrawFromProtocolState,
              withdrawEvmChain,
              BigInt(Math.floor(parseFloat(withdrawAmount.trim()) * 1_000_000))
            )}
            onSelectionChange={setWithdrawSelectedSteps}
            className="withdraw-steps"
          />
        </div>

        <div className="option-card">
          <h4>Option 3: Settle Transaction</h4>

          <div className="input-row">
            <div className="input-group">
              <label htmlFor="tx-id">Transaction ID:</label>
              <input
                id="tx-id"
                type="text"
                value={txId}
                onChange={e => setTxId(e.target.value)}
                placeholder="Enter transaction ID"
              />
            </div>
          </div>

          <div className="input-row">
            <div className="input-group">
              <label htmlFor="tx-status">Transaction Status:</label>
              <select
                id="tx-status"
                value={txStatus}
                onChange={e => setTxStatus(e.target.value)}
                className="chain-selector"
              >
                <option value="success">Success</option>
                <option value="failed">Failed</option>
              </select>
            </div>
          </div>

          <div className="input-row">
            <div className="input-group">
              <label htmlFor="prev-offer-id">Previous Offer ID:</label>
              <input
                id="prev-offer-id"
                type="text"
                value={prevOfferId}
                onChange={e => setPrevOfferId(e.target.value)}
                placeholder="Enter previous offer ID"
              />
            </div>
          </div>

          <div className="info-section">
            <p>
              This option will settle a CCTP transaction using the provided
              details.
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

            <button
              onClick={handleAcceptInvitation}
              className="accept-invitation-button"
            >
              Accept invitation
            </button>

            <button
              onClick={handleSettleTransaction}
              className="settle-transaction-button"
            >
              Settle transaction
            </button>

            <button onClick={handleWithdraw} className="withdraw-button">
              Withdraw USDC (Legacy)
            </button>

            <button
              onClick={handleWithdrawFromProtocol}
              className="withdraw-protocol-button"
            >
              Withdraw from Protocol
            </button>
          </div>
        ) : (
          <p>Please connect your wallet to make an offer.</p>
        )}
      </div>
    </div>
  );
};

export { Trade };
