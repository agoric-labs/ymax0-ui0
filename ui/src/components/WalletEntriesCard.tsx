import React from 'react';
import InvitationItem from './InvitationItem';

interface WalletEntriesCardProps {
  invitations: Array<[string, number]>;
  savedEntries: Set<string>;
  pendingEntries: Set<string>;
  onRedeemInvitation: (description: string, saveName: string, replace: boolean) => void;
  walletAddress: string;
}

const WalletEntriesCard: React.FC<WalletEntriesCardProps> = ({
  invitations,
  savedEntries,
  pendingEntries,
  onRedeemInvitation,
  walletAddress,
}) => {
  return (
    <div style={{ border: '2px solid #6f42c1', padding: '1rem', borderRadius: '8px', backgroundColor: '#f8f9ff' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ color: '#6f42c1', margin: 0 }}>💼 Wallet & Entries</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9em', color: '#666' }}>
          <span>{walletAddress}</span>
          <button
            onClick={() => navigator.clipboard.writeText(walletAddress)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '0',
              fontSize: '1em'
            }}
            title="Copy address"
          >
            📋
          </button>
        </div>
      </div>
      
      {/* Available Invitations */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h4 style={{ margin: '0 0 0.5rem 0', color: '#333', textAlign: 'left' }}>Available Invitations:</h4>
        {invitations.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {invitations.map(([description, index]) => (
              <InvitationItem
                key={`${description}-${index}`}
                description={description}
                index={index}
                onRedeem={onRedeemInvitation}
                isPending={pendingEntries.has(description)}
              />
            ))}
          </div>
        ) : (
          <p style={{ color: '#666', fontSize: '0.9em', margin: 0, textAlign: 'left' }}>No invitations available</p>
        )}
      </div>

      {/* Saved Results */}
      <div>
        <h4 style={{ margin: '0 0 0.5rem 0', color: '#333', textAlign: 'left' }}>Saved Results:</h4>
        {savedEntries.size > 0 || pendingEntries.size > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            {Array.from(savedEntries).map(name => (
              <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9em' }}>
                <span style={{ color: '#28a745' }}>✅</span>
                <span>{name}</span>
                <span style={{ color: '#666' }}>(ready)</span>
              </div>
            ))}
            {Array.from(pendingEntries).map(name => (
              <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9em' }}>
                <span style={{ color: '#ffc107' }}>⏳</span>
                <span>{name}</span>
                <span style={{ color: '#666' }}>(pending)</span>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: '#666', fontSize: '0.9em', margin: 0, textAlign: 'left' }}>
            📭 No saved entries found<br />
            <em>try showing more transaction history to find saved entries</em>
          </p>
        )}
      </div>
    </div>
  );
};

export default WalletEntriesCard;
