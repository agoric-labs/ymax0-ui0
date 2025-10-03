import React, { useState } from 'react';

interface InvitationItemProps {
  description: string;
  index: number;
  onRedeem: (description: string, saveName: string, replace: boolean) => void;
  isPending: boolean;
  readOnly?: boolean;
}

const InvitationItem: React.FC<InvitationItemProps> = ({
  description,
  index,
  onRedeem,
  isPending,
  readOnly = false,
}) => {
  const [saveName, setSaveName] = useState(description);
  const [replace, setReplace] = useState(true);

  return (
    <div key={`${description}-${index}`} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}>
      <span style={{ minWidth: '120px', fontSize: '0.9em' }}>{description}</span>
      <input
        type="text"
        value={saveName}
        onChange={(e) => setSaveName(e.target.value)}
        placeholder="Save as..."
        disabled={readOnly}
        style={{ 
          flex: 1,
          padding: '0.3rem', 
          border: '1px solid #ccc',
          borderRadius: '3px',
          fontSize: '0.9em',
          backgroundColor: readOnly ? '#f0f0f0' : 'white',
          color: readOnly ? '#666' : 'black'
        }}
      />
      <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.9em', color: readOnly ? '#666' : 'black' }}>
        <input
          type="checkbox"
          checked={replace}
          onChange={(e) => setReplace(e.target.checked)}
          disabled={readOnly}
        />
        Replace
      </label>
      <button 
        onClick={() => onRedeem(description, saveName, replace)}
        disabled={isPending || readOnly}
        title={readOnly ? 'Connect wallet to redeem invitations' : ''}
        style={{
          padding: '0.3rem 0.6rem',
          backgroundColor: (isPending || readOnly) ? '#ccc' : '#6f42c1',
          color: 'white',
          border: 'none',
          borderRadius: '3px',
          cursor: (isPending || readOnly) ? 'not-allowed' : 'pointer',
          fontSize: '0.9em'
        }}
      >
        {isPending ? 'Pending...' : 'Redeem'}
      </button>
    </div>
  );
};

export default InvitationItem;
