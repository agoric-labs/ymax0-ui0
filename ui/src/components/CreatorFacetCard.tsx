import React from 'react';

interface CreatorFacetCardProps {
  plannerAddress: string;
  setPlannerAddress: (value: string) => void;
  savedEntries: Set<string>;
  onDeliverPlannerInvitation: () => void;
  onCreateVault: () => void;
}

const CreatorFacetCard: React.FC<CreatorFacetCardProps> = ({
  plannerAddress,
  setPlannerAddress,
  savedEntries,
  onDeliverPlannerInvitation,
  onCreateVault,
}) => {
  return (
    <div style={{ border: '2px solid #28a745', padding: '1rem', borderRadius: '8px', backgroundColor: '#f8fff8' }}>
      <h3 style={{ color: '#28a745', marginTop: 0, textAlign: 'left' }}>YMax Creator Facet</h3>
      <p style={{ margin: '0 0 1rem 0', color: '#666', fontSize: '0.9em', textAlign: 'left' }}>
        Direct contract operations
      </p>

      {/* Deliver Planner Invitation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <label style={{ minWidth: '140px', fontWeight: 'bold' }}>Deliver Invitation:</label>
        <input
          type="text"
          value={plannerAddress}
          onChange={(e) => setPlannerAddress(e.target.value)}
          placeholder="Planner address (agoric1...)"
          style={{ 
            flex: 1,
            padding: '0.4rem', 
            border: '1px solid #ccc',
            borderRadius: '4px',
            fontSize: '0.9em'
          }}
        />
        <button 
          onClick={onDeliverPlannerInvitation}
          style={{
            padding: '0.4rem 0.8rem',
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '0.9em'
          }}
        >
          Deliver
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.75rem' }}>
        <label style={{ minWidth: '140px', fontWeight: 'bold' }}>Create Vault:</label>
        <div style={{ flex: 1, color: '#666', fontSize: '0.9em' }}>
          60% Aave_Base / 40% Compound_Base (spike default)
        </div>
        <button
          onClick={onCreateVault}
          style={{
            padding: '0.4rem 0.8rem',
            backgroundColor: '#0d6efd',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '0.9em',
          }}
        >
          Create
        </button>
      </div>
    </div>
  );
};

export default CreatorFacetCard;
