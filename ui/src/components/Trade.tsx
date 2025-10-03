import { stringifyAmountValue } from '@agoric/ui-components';
import { useState, useEffect } from 'react';
import { YieldProtocol, EVMChain } from '../ymax-client';
import { AgoricChainStoragePathKind as Kind } from '@agoric/rpc';
import { StepSelector, StepInfo } from './StepSelector';
import { Tabs, Tab } from './Tabs';
import {
  generateOpenPositionSteps,
  generateWithdrawSteps,
} from '../utils/stepUtils';
import {
  getLatestOpenPortfolioOfferId,
  getLatestResolverOfferId,
  fetchAllTransactions,
  PendingTransaction,
} from '../utils/walletUtils';

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
  const [openPositionSelectedSteps, setOpenPositionSelectedSteps] = useState<
    string[]
  >([]);
  const [withdrawSelectedSteps, setWithdrawSelectedSteps] = useState<string[]>(
    [],
  );

  // Auto-fetched offer ID state
  const [isLoadingOfferId, setIsLoadingOfferId] = useState(false);
  const [autoFetchedOfferId, setAutoFetchedOfferId] = useState<string | null>(
    null,
  );

  // Auto-fetched resolver offer ID state (for settle transaction)
  const [isLoadingResolverOfferId, setIsLoadingResolverOfferId] =
    useState(false);
  const [autoFetchedResolverOfferId, setAutoFetchedResolverOfferId] = useState<
    string | null
  >(null);

  // Pending transactions state
  const [allTransactions, setAllTransactions] = useState<PendingTransaction[]>([]);
  const [pendingTransactions, setPendingTransactions] = useState<PendingTransaction[]>([]);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);
  const [showOnlyPending, setShowOnlyPending] = useState<boolean>(true);

  // Fetch latest offer ID when wallet is connected
  useEffect(() => {
    const fetchLatestOfferId = async () => {
      if (walletConnected && walletAddress && watcher && !isLoadingOfferId) {
        setIsLoadingOfferId(true);
        try {
          console.log('Fetching latest offer ID for wallet:', walletAddress);
          const latestOfferId = await getLatestOpenPortfolioOfferId(
            watcher,
            walletAddress,
          );
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

  // Fetch latest resolver offer ID when wallet is connected
  useEffect(() => {
    const fetchLatestResolverOfferId = async () => {
      if (
        walletConnected &&
        walletAddress &&
        watcher &&
        !isLoadingResolverOfferId
      ) {
        setIsLoadingResolverOfferId(true);
        try {
          console.log(
            'Fetching latest resolver offer ID for wallet:',
            walletAddress,
          );
          const latestResolverOfferId = await getLatestResolverOfferId(
            watcher,
            walletAddress,
          );
          console.log('Fetched resolver offer ID:', latestResolverOfferId);
          if (latestResolverOfferId) {
            setAutoFetchedResolverOfferId(latestResolverOfferId);
            setPrevOfferId(latestResolverOfferId);
          } else {
            console.log('No resolver offers found for this wallet');
          }
        } catch (error) {
          console.error('Failed to fetch latest resolver offer ID:', error);
        } finally {
          setIsLoadingResolverOfferId(false);
        }
      }
    };

    // Add a small delay to ensure wallet connection is fully established
    const timeoutId = setTimeout(fetchLatestResolverOfferId, 1200); // Slightly after openPortfolio fetch
    return () => clearTimeout(timeoutId);
  }, [walletConnected, walletAddress, watcher, isLoadingResolverOfferId]);

  // Fetch transactions only once when watcher becomes available
  useEffect(() => {
    let isCancelled = false;
    
    const fetchTransactions = async () => {
      if (watcher && !isLoadingTransactions && !isCancelled && allTransactions.length === 0) {
        console.log('Loading transactions from blockchain...');
        setIsLoadingTransactions(true);
        try {
          const transactions = await fetchAllTransactions(watcher);
          
          if (isCancelled) {
            return;
          }
          
          console.log(`Loaded ${transactions.length} transactions from blockchain`);
          setAllTransactions(transactions);
          
          // Filter based on checkbox state
          const filteredTransactions = showOnlyPending 
            ? transactions.filter(tx => tx.status === 'pending')
            : transactions;
          setPendingTransactions(filteredTransactions);
          
          // If we have transactions and no txId is set, set the first one
          if (filteredTransactions.length > 0 && !txId) {
            setTxId(filteredTransactions[0].id);
          }
        } catch (error) {
          if (!isCancelled) {
            console.error('Failed to fetch transactions:', error);
            console.error('Error details:', error instanceof Error ? error.message : 'Unknown error');
          }
        } finally {
          if (!isCancelled) {
            setIsLoadingTransactions(false);
          }
        }
      }
    };

    // Add a delay to ensure watcher is ready, but only run once
    if (watcher && allTransactions.length === 0) {
      const timeoutId = setTimeout(fetchTransactions, 2000);
      
      return () => {
        isCancelled = true;
        clearTimeout(timeoutId);
      };
    }
  }, [watcher]); // Only depend on watcher
  
  // Filter transactions when checkbox state changes
  useEffect(() => {
    const filteredTransactions = showOnlyPending 
      ? allTransactions.filter(tx => tx.status === 'pending')
      : allTransactions;
      
    setPendingTransactions(filteredTransactions);
    
    // Update selected txId if current selection is not in filtered results
    if (txId && !filteredTransactions.find(tx => tx.id === txId) && filteredTransactions.length > 0) {
      setTxId(filteredTransactions[0].id);
    }
  }, [showOnlyPending, allTransactions, txId]);

  // Manual refresh function
  const handleRefreshOfferId = async () => {
    if (walletConnected && walletAddress && watcher && !isLoadingOfferId) {
      setIsLoadingOfferId(true);
      try {
        const latestOfferId = await getLatestOpenPortfolioOfferId(
          watcher,
          walletAddress,
        );
        if (latestOfferId) {
          setAutoFetchedOfferId(latestOfferId);
          setWithdrawPrevOfferId(latestOfferId);
        }
      } catch (error) {
        console.error('Failed to refresh offer ID:', error);
        alert(
          'Failed to fetch latest offer ID. Please check console for details.',
        );
      } finally {
        setIsLoadingOfferId(false);
      }
    }
  };

  // Manual refresh function for resolver offer ID
  const handleRefreshResolverOfferId = async () => {
    if (
      walletConnected &&
      walletAddress &&
      watcher &&
      !isLoadingResolverOfferId
    ) {
      setIsLoadingResolverOfferId(true);
      try {
        const latestResolverOfferId = await getLatestResolverOfferId(
          watcher,
          walletAddress,
        );
        if (latestResolverOfferId) {
          setAutoFetchedResolverOfferId(latestResolverOfferId);
          setPrevOfferId(latestResolverOfferId);
        }
      } catch (error) {
        console.error('Failed to refresh resolver offer ID:', error);
        alert(
          'Failed to fetch latest resolver offer ID. Please check console for details.',
        );
      } finally {
        setIsLoadingResolverOfferId(false);
      }
    }
  };

  // Handle checkbox change
  const handleShowOnlyPendingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setShowOnlyPending(e.target.checked);
  };
  
  // Manual refresh function for transactions
  const handleRefreshTransactions = async () => {
    if (watcher && !isLoadingTransactions) {
      setIsLoadingTransactions(true);
      try {
        console.log('Refreshing transactions from blockchain...');
        const transactions = await fetchAllTransactions(watcher);
        console.log(`Refreshed ${transactions.length} transactions`);
        setAllTransactions(transactions);
        
        // Filter based on current checkbox state
        const filteredTransactions = showOnlyPending 
          ? transactions.filter(tx => tx.status === 'pending')
          : transactions;
        setPendingTransactions(filteredTransactions);
      } catch (error) {
        console.error('Failed to refresh transactions:', error);
        alert('Failed to refresh transactions. Please check console for details.');
      } finally {
        setIsLoadingTransactions(false);
      }
    }
  };

  // Debug function to test vstorage path directly
  const handleTestVstorage = async () => {
    if (!watcher) {
      console.log('No watcher available for testing');
      alert('Watcher not available');
      return;
    }

    console.log('=== TESTING VSTORAGE PATHS ===');
    const testPaths = [
      { path: 'published.ymax0.pendingTxs', kind: Kind.Children },
      { path: 'published.ymax0.pendingTxs', kind: Kind.Data },
      { path: 'published.ymax0', kind: Kind.Data },
      { path: 'published.ymax0.pendingTxs.tx0', kind: Kind.Data },
      { path: 'published.ymax0.transactions', kind: Kind.Children },
    ];

    for (const testPath of testPaths) {
      console.log(`\n--- Testing path: ${testPath.path} (${testPath.kind === Kind.Children ? 'Children' : 'Data'}) ---`);
      try {
        let dataReceived = false;
        let unsubscribe: (() => void) | null = null;
        
        unsubscribe = watcher.watchLatest(
          [testPath.kind, testPath.path],
          (data: any) => {
            dataReceived = true;
            console.log(`✅ SUCCESS - Data from ${testPath.path} (${testPath.kind === Kind.Children ? 'Children' : 'Data'}):`);
            console.log('Data type:', typeof data);
            console.log('Data === null:', data === null);
            console.log('Data === undefined:', data === undefined);
            console.log('Data:', data);
            if (data && data !== '') {
              console.log('Data stringified:', JSON.stringify(data, null, 2));
            }
            
            if (unsubscribe) {
              unsubscribe();
              unsubscribe = null;
            }
          }
        );

        // Wait for response or timeout
        await new Promise(resolve => {
          setTimeout(() => {
            if (!dataReceived) {
              console.log(`❌ No data received from ${testPath.path} (${testPath.kind === Kind.Children ? 'Children' : 'Data'}) within 3 seconds`);
            }
            if (unsubscribe) {
              unsubscribe();
              unsubscribe = null;
            }
            resolve(undefined);
          }, 3000);
        });

      } catch (error) {
        console.error(`❌ ERROR testing ${testPath.path} (${testPath.kind === Kind.Children ? 'Children' : 'Data'}):`, error);
      }
      
      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('\n=== VSTORAGE PATH TESTING COMPLETE ===');
    alert('Debug complete! Check console for results.');
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

    makeOffer(
      usdcValue,
      bldValue,
      yieldProtocol,
      evmChainParam,
      openPositionSelectedSteps,
    );
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

  // Create tab content components
  const OpenPositionTab = (
    <div className="tab-panel">
      <div className="panel-header">
        <h3>Open Position</h3>
        <p>Create a new position with USDC in yield protocols</p>
      </div>

      <div className="form-section">
        <div className="input-row three-cols">
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

          <div className="input-group">
            <label htmlFor="yield-protocol">Yield Protocol:</label>
            <select
              id="yield-protocol"
              value={yieldProtocol}
              onChange={e => setYieldProtocol(e.target.value as YieldProtocol)}
              className="chain-selector"
            >
              <option value="USDN">USDN</option>
              <option value="Aave">Aave</option>
              <option value="Compound">Compound</option>
            </select>
          </div>
        </div>

        {/* EVM Chain Selector - only visible when Aave or Compound is selected */}
        {(yieldProtocol === 'Aave' || yieldProtocol === 'Compound') && (
          <div className="input-row">
            <div className="input-group">
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
          </div>
        )}

        <div className="balance-display">
          <h5>Current Balances:</h5>
          <div className="balance-grid">
            <div className="balance-card">
              <div className="balance-label">USDC</div>
              <div className="balance-value usdc">
                {usdcPurse
                  ? stringifyAmountValue(
                      usdcPurse.currentAmount,
                      usdcPurse.displayInfo.assetKind,
                      usdcPurse.displayInfo.decimalPlaces,
                    )
                  : 'Loading...'}
              </div>
            </div>
            <div className="balance-card">
              <div className="balance-label">BLD</div>
              <div className="balance-value bld">
                {bldPurse
                  ? stringifyAmountValue(
                      bldPurse.currentAmount,
                      bldPurse.displayInfo.assetKind,
                      bldPurse.displayInfo.decimalPlaces,
                    )
                  : 'Loading...'}
              </div>
            </div>
            <div className="balance-card">
              <div className="balance-label">PoC26</div>
              <div className="balance-value poc26">
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
        </div>

        <StepSelector
          title="Show Steps"
          steps={generateOpenPositionSteps(
            yieldProtocol,
            evmChain,
            BigInt(Math.floor(parseFloat(usdcAmount.trim()) * 1_000_000)),
          )}
          onSelectionChange={setOpenPositionSelectedSteps}
          className="open-position-steps"
        />

        <div className="action-section">
          {walletConnected ? (
            <button onClick={handleMakeOffer} className="primary-button">
              Open Position
            </button>
          ) : (
            <p>Please connect your wallet to make an offer.</p>
          )}
        </div>
      </div>
    </div>
  );

  const WithdrawTab = (
    <div className="tab-panel">
      <div className="panel-header">
        <h3>Withdraw from Protocol</h3>
        <p>Withdraw funds from your protocol positions</p>
      </div>

      <div className="form-section">
        <div className="input-row three-cols">
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
                    ? 'Fetching latest offer ID...'
                    : 'Enter previous offer ID'
                }
                disabled={isLoadingOfferId}
              />
              {walletConnected && (
                <button
                  type="button"
                  onClick={handleRefreshOfferId}
                  disabled={isLoadingOfferId}
                  className="refresh-offer-button"
                  title="Refresh latest offer ID from blockchain"
                >
                  {isLoadingOfferId ? '⟳' : '🔄'}
                </button>
              )}
            </div>
          </div>

          <div className="input-group">
            <label htmlFor="withdraw-protocol">Withdraw From Protocol:</label>
            <select
              id="withdraw-protocol"
              value={withdrawFromProtocolState}
              onChange={e => setWithdrawFromProtocolState(e.target.value as YieldProtocol)}
              className="chain-selector"
            >
              <option value="USDN">USDN</option>
              <option value="Aave">Aave</option>
              <option value="Compound">Compound</option>
            </select>
          </div>
        </div>

        {/* EVM Chain Selector - only visible when Aave or Compound is selected */}
        {(withdrawFromProtocolState === 'Aave' ||
          withdrawFromProtocolState === 'Compound') && (
          <div className="input-row">
            <div className="input-group">
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
          </div>
        )}

        <div className="info-section">
          <p>
            This will withdraw the specified amount from your selected protocol
            position back to your USDC balance.
          </p>
        </div>

        <StepSelector
          title="Show Steps"
          steps={generateWithdrawSteps(
            withdrawFromProtocolState,
            withdrawEvmChain,
            BigInt(Math.floor(parseFloat(withdrawAmount.trim()) * 1_000_000)),
          )}
          onSelectionChange={setWithdrawSelectedSteps}
          className="withdraw-steps"
        />

        <div className="action-section">
          {walletConnected ? (
            <button
              onClick={handleWithdrawFromProtocol}
              className="primary-button"
            >
              Withdraw from Protocol
            </button>
          ) : (
            <p>Please connect your wallet to withdraw.</p>
          )}
        </div>
      </div>
    </div>
  );

  const SettleTransactionTab = (
    <div className="tab-panel">
      <div className="panel-header">
        <h3>Settle Transaction</h3>
        <p>Settle CCTP transactions using transaction details</p>
      </div>

      <div className="form-section">
        <div className="input-row">
          <div className="input-group checkbox-group">
            <label htmlFor="show-only-pending" className="checkbox-label">
              <input
                id="show-only-pending"
                type="checkbox"
                checked={showOnlyPending}
                onChange={handleShowOnlyPendingChange}
                className="transaction-filter-checkbox"
              />
              Show only pending transactions
            </label>
          </div>
        </div>

        <div className="input-row three-cols">
          <div className="input-group">
            <label htmlFor="tx-id">
              Transaction ID:
              {isLoadingTransactions && (
                <span className="loading-indicator"> (Loading...)</span>
              )}
            </label>
            <div className="input-with-button">
              <select
                id="tx-id"
                value={txId}
                onChange={e => setTxId(e.target.value)}
                className="chain-selector"
                disabled={isLoadingTransactions}
              >
                <option value="">
                  {isLoadingTransactions 
                    ? "Loading pending transactions..." 
                    : pendingTransactions.length === 0
                    ? "No pending transactions"
                    : "Select transaction ID"
                  }
                </option>
                {pendingTransactions.map((tx) => (
                  <option key={tx.id} value={tx.id}>
                    {tx.id} - {tx.type} ({tx.amount})
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleRefreshTransactions}
                disabled={isLoadingTransactions}
                className="refresh-offer-button"
                title="Refresh pending transactions from blockchain"
              >
                {isLoadingTransactions ? '⟳' : '🔄'}
              </button>
            </div>
          </div>

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

          <div className="input-group">
            <label htmlFor="prev-offer-id">
              Previous Offer ID:
              {isLoadingResolverOfferId && (
                <span className="loading-indicator"> (Loading...)</span>
              )}
              {autoFetchedResolverOfferId && !isLoadingResolverOfferId && (
                <span className="auto-fetched-indicator"> (Auto-fetched)</span>
              )}
            </label>
            <div className="input-with-button">
              <input
                id="prev-offer-id"
                type="text"
                value={prevOfferId}
                onChange={e => setPrevOfferId(e.target.value)}
                placeholder={
                  isLoadingResolverOfferId
                    ? 'Fetching latest resolver offer ID...'
                    : 'Enter previous offer ID'
                }
                disabled={isLoadingResolverOfferId}
              />
              {walletConnected && (
                <button
                  type="button"
                  onClick={handleRefreshResolverOfferId}
                  disabled={isLoadingResolverOfferId}
                  className="refresh-offer-button"
                  title="Refresh latest resolver offer ID from blockchain"
                >
                  {isLoadingResolverOfferId ? '⟳' : '🔄'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Transaction Details Display */}
        {txId && pendingTransactions.find(tx => tx.id === txId) && (
          <div className="transaction-details">
            <h4>Transaction Details:</h4>
            {(() => {
              const selectedTx = pendingTransactions.find(tx => tx.id === txId);
              return selectedTx ? (
                <div className="transaction-info">
                  <div className="detail-row">
                    <span className="detail-label">Type:</span>
                    <span className="detail-value">{selectedTx.type}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Amount:</span>
                    <span className="detail-value">{selectedTx.amount}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Destination:</span>
                    <span className="detail-value transaction-address">{selectedTx.destinationAddress}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Status:</span>
                    <span className={`detail-value status-${selectedTx.status.toLowerCase()}`}>
                      {selectedTx.status}
                    </span>
                  </div>
                </div>
              ) : null;
            })()}
          </div>
        )}

        <div className="info-section">
          <p>
            This option will settle a CCTP transaction using the provided
            details. Select a pending transaction from the dropdown above.
          </p>
          
          {pendingTransactions.length === 0 && !isLoadingTransactions && (
            <div className="transaction-status">
              <p><strong>Status:</strong> No pending transactions found in blockchain storage.</p>
              <p><small>The vstorage path <code>published.ymax0.pendingTxs</code> exists but contains no data yet.</small></p>
            </div>
          )}

          {watcher && (
            <div style={{ marginTop: '10px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button
                onClick={handleTestVstorage}
                className="secondary-button"
              >
                🔧 Test Vstorage Paths (Debug)
              </button>
              <button
                onClick={handleRefreshTransactions}
                className="secondary-button"
                disabled={isLoadingTransactions}
              >
                {isLoadingTransactions ? '⟳ Loading...' : '🔄 Refresh Transactions'}
              </button>
            </div>
          )}
        </div>

        <div className="action-section">
          {walletConnected ? (
            <div className="button-group">
              <button
                onClick={handleSettleTransaction}
                className="primary-button"
              >
                Settle Transaction
              </button>
              <button
                onClick={handleOpenEmptyPortfolio}
                className="secondary-button"
              >
                Open Empty Portfolio
              </button>
              <button
                onClick={handleAcceptInvitation}
                className="secondary-button"
              >
                Accept Invitation
              </button>
              <button onClick={handleWithdraw} className="secondary-button">
                Withdraw USDC (Legacy)
              </button>
            </div>
          ) : (
            <p>Please connect your wallet to settle transactions.</p>
          )}
        </div>
      </div>
    </div>
  );

  // Create tabs array
  const tabs: Tab[] = [
    {
      id: 'open-position',
      label: 'Open Position',
      content: OpenPositionTab,
    },
    {
      id: 'withdraw',
      label: 'Withdraw',
      content: WithdrawTab,
    },
    {
      id: 'settle',
      label: 'Settle Transaction',
      content: SettleTransactionTab,
    },
  ];

  return (
    <div className="trade-container">
      <div className="page-header">
        <h1>ymax-dev-ui</h1>
        <p className="page-subtitle">Yield Maximization Protocol Interface</p>
      </div>

      <Tabs tabs={tabs} defaultTab="open-position" />
    </div>
  );
};

export { Trade };
