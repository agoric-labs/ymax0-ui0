import { stringifyAmountValue } from '@agoric/ui-components';

type TradeProps = {
  makeOffer: () => void;
  withdrawUSDC: () => void;
  openEmptyPortfolio: () => void;
  istPurse: Purse;
  walletConnected: boolean;
  offerId?: number;
  usdcPurse?: Purse;
};

// Simplified Trade component with only a fixed USDC give amount
const Trade = ({
  makeOffer,
  withdrawUSDC,
  openEmptyPortfolio,
  walletConnected,
  offerId,
  usdcPurse,
}: TradeProps) => {
  // Handle making an offer
  const handleMakeOffer = () => {
    makeOffer();
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
      <div className="trade">
        <h3>Offer Options</h3>
        <div className="offer-details">
          <h4>Option 1: Make Offer with USDC</h4>
          <p>
            This offer will send exactly <strong>1.10 USDC</strong> to the
            contract.
          </p>
          {usdcPurse && (
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
          )}
          <p>
            The offer is configured to only include the "give" part without a
            "want" part.
          </p>
          <p>
            After locking funds, you can withdraw using the withdraw button.
          </p>

          <h4>Option 2: Open Empty Portfolio</h4>
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

      <div className="offer-actions">
        {walletConnected ? (
          <div className="button-group">
            <button onClick={handleMakeOffer}>
              Make Offer (at least 1.0 USDC)
            </button>

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

      <style>{`
        .offer-details {
          border: 1px solid #ddd;
          border-radius: 5px;
          padding: 15px;
          margin-bottom: 20px;
        }
        
        .offer-details p {
          margin: 8px 0;
        }
        
        .offer-actions {
          margin-top: 20px;
        }
        
        .button-group {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }
        
        .withdraw-button {
          background-color: #4a90e2;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          transition: background-color 0.3s;
        }
        
        .withdraw-button:hover {
          background-color: #3a7bbd;
        }
        
        .empty-portfolio-button {
          background-color: #5cb85c;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          transition: background-color 0.3s;
        }
        
        .empty-portfolio-button:hover {
          background-color: #4cae4c;
        }

        .modal {
          display: block;
          position: fixed;
          z-index: 1;
          left: 0;
          top: 0;
          width: 100%;
          height: 100%;
          background-color: rgba(0,0,0,0.4);
        }
        
        .modal-content {
          margin: 15% auto;
          padding: 20px;
          border: 1px solid #888;
          width: 80%;
          max-width: 600px;
          border-radius: 5px;
        }
        
        .close {
          color: #aaa;
          float: right;
          font-size: 28px;
          font-weight: bold;
          cursor: pointer;
        }
        
        pre {
          background-color: #f8f8f8;
          border: 1px solid #ddd;
          border-radius: 3px;
          padding: 10px;
          overflow: auto;
          max-height: 400px;
        }

        @media (prefers-color-scheme: light) {
          .offer-details {
            background-color: #f5f5f5;
          }
          .modal-content {
            background-color: #fefefe;
          }
        }

      `}</style>
    </>
  );
};

export { Trade };
