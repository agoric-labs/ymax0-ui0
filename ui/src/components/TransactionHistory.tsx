import React, { useState, useEffect } from 'react';
import { formatActionColumn } from './Admin.utils.tsx';

const formatTimestamp = (timestamp: string) => {
  const d = new Date(timestamp);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
};

const TransactionRow = ({ tx, index, getCompletionStatus, getInvocationId, pendingInvocations }: { 
  tx: any; 
  index: number;
  getCompletionStatus: (id: number) => string;
  getInvocationId: (tx: any) => number | null;
  pendingInvocations: Set<number>;
}) => {
  const message = tx.tx?.body?.messages?.[0];
  const messageType = message?.['@type'] || 'N/A';
  const shortHash = `${tx.txhash.substring(0, 6)}...${tx.txhash.substring(
    tx.txhash.length - 6,
  )}`;

  const { actionDisplay, actionToCopy } = formatActionColumn(message);
  const invocationId = getInvocationId(tx);
  const isInvokeEntry = ['/agoric.swingset.MsgWalletAction', '/agoric.swingset.MsgWalletSpendAction'].includes(messageType) && invocationId !== null;
  const isUIInitiated = invocationId !== null && pendingInvocations.has(invocationId);

  return (
    <tr
      style={{ 
        backgroundColor: index % 2 ? '#f9f9f9' : 'white',
        borderLeft: isUIInitiated ? '4px solid #007bff' : 'none'
      }}
    >
      <td style={{ border: '1px solid #ddd', padding: '4px' }}>{tx.height}</td>
      <td style={{ border: '1px solid #ddd', padding: '4px' }}>
        {formatTimestamp(tx.timestamp)}
      </td>
      <td style={{ border: '1px solid #ddd', padding: '4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {messageType}
          {isUIInitiated && (
            <span 
              style={{ 
                fontSize: '0.7em', 
                backgroundColor: '#007bff', 
                color: 'white', 
                padding: '2px 4px', 
                borderRadius: '3px' 
              }}
              title="Initiated through this UI"
            >
              UI
            </span>
          )}
        </div>
        <div style={{ fontFamily: 'monospace' }} title={tx.txhash}>
          {shortHash}{' '}
          <button
            onClick={() => navigator.clipboard.writeText(tx.txhash)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '0',
            }}
            title="Copy hash"
          >
            📋
          </button>
        </div>
      </td>
      <td style={{ border: '1px solid #ddd', padding: '4px' }}>
        <div style={{ maxHeight: '8em', overflowY: 'auto' }}>
          {actionDisplay}
        </div>
        {actionToCopy && (
          <button
            onClick={() => navigator.clipboard.writeText(actionToCopy)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '0.5em 0 0 0',
            }}
            title="Copy action"
          >
            📋
          </button>
        )}
      </td>
      <td style={{ border: '1px solid #ddd', padding: '4px' }}>
        {isInvokeEntry ? (
          (() => {
            const completionInfo = getCompletionStatus(invocationId);
            return (
              <div>
                <CompletionStatus 
                  status={completionInfo.status} 
                  result={completionInfo.result}
                />
                <small style={{ display: 'block', fontSize: '0.8em', color: '#666' }}>
                  ID: {invocationId}
                </small>
              </div>
            );
          })()
        ) : (
          <span style={{ color: '#999' }}>N/A</span>
        )}
      </td>
    </tr>
  );
};

interface TransactionHistoryProps {
  transactions: any[];
  transactionLimit: number;
  onTransactionLimitChange: (limit: number) => void;
  walletAddress?: string;
  vsc?: any; // vstorage client
  marshaller?: any; // marshaller for deserializing capData
  pendingInvocations?: Set<number>; // UI-initiated pending invocations
  walletUpdates?: any[]; // Live wallet updates from Admin
}

const CompletionStatus = ({ status, result }: { status: string; result?: any }) => {
  const getStatusDisplay = () => {
    switch (status) {
      case 'completed':
        return <span style={{color: 'green'}}>✅ Complete</span>;
      case 'failed':
        return <span style={{color: 'red'}}>❌ Failed</span>;
      case 'unknown':
        return <span style={{color: 'gray'}}>❓ Unknown</span>;
      default:
        return <span style={{color: 'gray'}}>N/A</span>;
    }
  };

  const getResultInfo = () => {
    if (!result) return null;
    
    const parts = [];
    if (result.passStyle) {
      parts.push(`${result.passStyle}`);
    }
    if (result.name) {
      parts.push(`"${result.name}"`);
    }
    
    return parts.length > 0 ? (
      <small style={{ display: 'block', fontSize: '0.7em', color: '#666', marginTop: '2px' }}>
        {parts.join(' ')}
      </small>
    ) : null;
  };

  return (
    <div>
      {getStatusDisplay()}
      {getResultInfo()}
    </div>
  );
};

const TransactionHistory: React.FC<TransactionHistoryProps> = ({ 
  transactions, 
  transactionLimit, 
  onTransactionLimitChange,
  walletAddress,
  vsc,
  marshaller,
  pendingInvocations = new Set(),
  walletUpdates: liveWalletUpdates = []
}) => {
  const [historicalWalletUpdates, setHistoricalWalletUpdates] = useState<any[]>([]);

  // Fetch historical wallet updates once when component mounts or wallet address changes
  useEffect(() => {
    const loadWalletUpdates = async () => {
      if (!walletAddress || !vsc || !marshaller) {
        return;
      }
      
      try {
        const updates = await vsc.readFully(`published.wallet.${walletAddress}`);
        console.log('TransactionHistory: readFully raw result:', updates?.slice(0, 2));
        
        // Parse and deserialize wallet updates immediately
        const deserializedUpdates = (updates || []).map((updateString: string) => {
          try {
            const capData = JSON.parse(updateString);
            const deserialized = marshaller.fromCapData(capData);
            return deserialized;
          } catch (error) {
            console.warn('Failed to deserialize wallet update:', error);
            return null;
          }
        }).filter(Boolean);
        
        console.log('TransactionHistory: parsed wallet updates:', deserializedUpdates.slice(0, 2));
        setHistoricalWalletUpdates(deserializedUpdates);
      } catch (error) {
        console.warn('TransactionHistory: readFully failed:', error);
        setHistoricalWalletUpdates([]);
      }
    };
    
    loadWalletUpdates();
  }, [walletAddress, vsc, marshaller]);

  // Combine historical and live wallet updates
  const allWalletUpdates = [...historicalWalletUpdates, ...liveWalletUpdates];

  // Helper to find completion status for a given invocation ID
  const getCompletionStatus = (invocationId: number): { status: string; result?: any } => {
    if (!allWalletUpdates.length) return { status: 'unknown' };
    
    const completionUpdate = allWalletUpdates.find((update: any) => {
      return update.updated === 'invocation' && 
             update.id === invocationId && 
             (update.result !== undefined || update.error !== undefined);
    });
    
    if (!completionUpdate) return { status: 'unknown' };
    
    const status = completionUpdate.error ? 'failed' : 'completed';
    return { status, result: completionUpdate.result };
  };

  // Extract invocation ID from transaction message
  const getInvocationId = (tx: any): number | null => {
    const message = tx.tx?.body?.messages?.[0];
    const messageType = message?.['@type'];
    
    if (['/agoric.swingset.MsgWalletAction', '/agoric.swingset.MsgWalletSpendAction'].includes(messageType) && marshaller) {
      try {
        const actionString = messageType === '/agoric.swingset.MsgWalletSpendAction' ? message.spend_action : message.action;
        const capData = JSON.parse(actionString);
        const action = marshaller.fromCapData(capData);
        
        if (action.method === 'invokeEntry' && action.message?.id) {
          return action.message.id;
        }
      } catch (error) {
        console.warn('Failed to parse transaction action:', error);
      }
    }
    return null;
  };

  return (
    <div style={{ marginTop: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ margin: 0, textAlign: 'left' }}>Recent Transactions</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <label htmlFor="transaction-limit" style={{ fontSize: '0.9em' }}>Show:</label>
          <select
            id="transaction-limit"
            value={transactionLimit}
            onChange={(e) => onTransactionLimitChange(Number(e.target.value))}
            style={{
              padding: '0.3rem',
              border: '1px solid #ccc',
              borderRadius: '4px',
              fontSize: '0.9em'
            }}
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={200}>200</option>
          </select>
        </div>
      </div>
      {transactions.length > 0 ? (
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '0.875rem',
          }}
        >
          <thead>
            <tr>
              <th style={{ border: '1px solid #ddd', padding: '4px', textAlign: 'left' }}>Block Height</th>
              <th style={{ border: '1px solid #ddd', padding: '4px', textAlign: 'left' }}>Time</th>
              <th style={{ border: '1px solid #ddd', padding: '4px', textAlign: 'left' }}>Message</th>
              <th style={{ border: '1px solid #ddd', padding: '4px', textAlign: 'left' }}>Action</th>
              <th style={{ border: '1px solid #ddd', padding: '4px', textAlign: 'left' }}>Completion</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx, index) => (
              <TransactionRow 
                key={tx.txhash} 
                tx={tx} 
                index={index}
                getCompletionStatus={getCompletionStatus}
                getInvocationId={getInvocationId}
                pendingInvocations={pendingInvocations}
              />
            ))}
          </tbody>
        </table>
      ) : (
        <p style={{ textAlign: 'left' }}>No recent transactions found.</p>
      )}
    </div>
  );
};

export default TransactionHistory;
