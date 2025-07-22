import { stringifyAmountValue } from '@agoric/ui-components';
import { useState } from 'react';

// Define position types
export type PositionType = 'USDN' | 'Aave';

type TradeProps = {
  makeOffer: (
    usdcAmount: bigint,
    bldFeeAmount: bigint,
    positionType: PositionType,
  ) => void;
  withdrawUSDC: () => void;
  openEmptyPortfolio: () => void;
  istPurse: Purse;
  walletConnected: boolean;
  offerId?: number;
  usdcPurse?: Purse;
};

// Simplified Trade component with customizable USDC and BLD fee amounts
const Trade = ({
  makeOffer,
  withdrawUSDC,
  openEmptyPortfolio,
  walletConnected,
  offerId,
  usdcPurse,
}: TradeProps) => {
  // Default to 1.25 USDC and 20 BLD
  const [usdcAmount, setUsdcAmount] = useState<string>('1.25');
  const [bldFeeAmount, setBldFeeAmount] = useState<string>('20');
  const [positionType, setPositionType] = useState<PositionType>('Aave');

  // Handle making an offer
  const handleMakeOffer = () => {
    // Convert USDC amount to bigint (USDC has 6 decimal places)
    const usdcValue = BigInt(Math.floor(parseFloat(usdcAmount) * 1_000_000));

    // Convert BLD fee amount to bigint (BLD has 6 decimal places)
    const bldValue = BigInt(Math.floor(parseFloat(bldFeeAmount) * 1_000_000));

    makeOffer(usdcValue, bldValue, positionType);
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
    <>
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
              />
            </div>
          </div>

          <div className="input-group position-select">
            <label>Position Type:</label>
            <div className="radio-group">
              <label className="radio-label">
                <input
                  type="radio"
                  name="positionType"
                  value="USDN"
                  checked={positionType === 'USDN'}
                  onChange={() => setPositionType('USDN')}
                />
                USDN
              </label>
              <label className="radio-label">
                <input
                  type="radio"
                  name="positionType"
                  value="Aave"
                  checked={positionType === 'Aave'}
                  onChange={() => setPositionType('Aave')}
                />
                Aave
              </label>
            </div>
          </div>

          {usdcPurse && (
            <div className="balance-display">
              <p>
                Your current USDC balance:{' '}
                <strong>
                  {stringifyAmountValue(
                    usdcPurse.currentAmount,
                    usdcPurse.displayInfo.assetKind,
                    usdcPurse.displayInfo.decimalPlaces,
                  )}
                </strong>
              </p>
            </div>
          )}
          <div className="info-section">
            <p>
              The offer is configured to only include the "give" part without a
              "want" part.
            </p>
            <p>
              After locking funds, you can withdraw using the withdraw button.
            </p>
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
    </>
  );
};

export { Trade };
