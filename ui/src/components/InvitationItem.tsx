import React, { useState } from 'react';

interface InvitationItemProps {
  description: string;
  index: number;
  onRedeem: (description: string, saveName: string, replace: boolean) => void;
  isPending: boolean;
}

const InvitationItem: React.FC<InvitationItemProps> = ({
  description,
  index,
  onRedeem,
  isPending,
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
        style={{ 
          flex: 1,
          padding: '0.3rem', 
          border: '1px solid #ccc',
          borderRadius: '3px',
          fontSize: '0.9em'
        }}
      />
      <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.9em' }}>
        <input
          type="checkbox"
          checked={replace}
          onChange={(e) => setReplace(e.target.checked)}
        />
        Replace
      </label>
      <button 
        onClick={() => onRedeem(description, saveName, replace)}
        disabled={isPending}
        style={{
          padding: '0.3rem 0.6rem',
          backgroundColor: isPending ? '#ccc' : '#6f42c1',
          color: 'white',
          border: 'none',
          borderRadius: '3px',
          cursor: isPending ? 'not-allowed' : 'pointer',
          fontSize: '0.9em'
        }}
      >
        {isPending ? 'Pending...' : 'Redeem'}
      </button>
    </div>
  );
};

export default InvitationItem;
