import { stringifyAmountValue } from '@agoric/ui-components';

type InventoryProps = {
  address: string;
  istPurse: Purse;
  itemsPurse: Purse;
  usdcPurse?: Purse;
  bldPurse?: Purse;
  poc26Purse?: Purse;
};

const Inventory = ({
  address,
  istPurse,
  itemsPurse,
  usdcPurse,
  bldPurse,
  poc26Purse,
}: InventoryProps) => (
  <div className="card">
    <h3>My Wallet</h3>
    <div>
      <div>
        <small>
          <code>{address}</code>
        </small>
      </div>

      <div style={{ textAlign: 'left' }}>
        <div>
          <b>IST: </b>
          {stringifyAmountValue(
            istPurse.currentAmount,
            istPurse.displayInfo.assetKind,
            istPurse.displayInfo.decimalPlaces,
          )}
        </div>
        {usdcPurse && (
          <div>
            <b>USDC: </b>
            {stringifyAmountValue(
              usdcPurse.currentAmount,
              usdcPurse.displayInfo.assetKind,
              usdcPurse.displayInfo.decimalPlaces,
            )}
          </div>
        )}
        {bldPurse && (
          <div>
            <b>BLD: </b>
            {stringifyAmountValue(
              bldPurse.currentAmount,
              bldPurse.displayInfo.assetKind,
              bldPurse.displayInfo.decimalPlaces,
            )}
          </div>
        )}
        {poc26Purse && (
          <div>
            <b>PoC26: </b>
            {stringifyAmountValue(
              poc26Purse.currentAmount,
              poc26Purse.displayInfo.assetKind,
              poc26Purse.displayInfo.decimalPlaces,
            )}
          </div>
        )}
        <div>
          <b>Items:</b>
          {itemsPurse ? (
            <ul style={{ marginTop: 0, textAlign: 'left' }}>
              {(itemsPurse.currentAmount.value as CopyBag).payload.map(
                ([name, number]) => (
                  <li key={name}>
                    {String(number)} {name}
                  </li>
                ),
              )}
            </ul>
          ) : (
            'None'
          )}
        </div>
      </div>
    </div>
  </div>
);

export { Inventory };
