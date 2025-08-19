import React from 'react';

interface ContractControlCardProps {
  instanceInfo: { ymax0?: string; postalService?: string } | null;
  instanceBlockHeight: string | null;
  creatorFacetName: string;
  setCreatorFacetName: (value: string) => void;
  terminateMessage: string;
  setTerminateMessage: (value: string) => void;
  upgradeBundleId: string;
  setUpgradeBundleId: (value: string) => void;
  installBundleId: string;
  setInstallBundleId: (value: string) => void;
  savedEntries: Set<string>;
  onGetCreatorFacet: () => void;
  onTerminate: () => void;
  onUpgrade: () => void;
  onInstallAndStart: () => void;
}

const ContractControlCard: React.FC<ContractControlCardProps> = ({
  instanceInfo,
  instanceBlockHeight,
  creatorFacetName,
  setCreatorFacetName,
  terminateMessage,
  setTerminateMessage,
  upgradeBundleId,
  setUpgradeBundleId,
  installBundleId,
  setInstallBundleId,
  savedEntries,
  onGetCreatorFacet,
  onTerminate,
  onUpgrade,
  onInstallAndStart,
}) => {
  return (
    <div style={{ border: '2px solid #007bff', padding: '1rem', borderRadius: '8px', backgroundColor: '#f8f9fa' }}>
      <h3 style={{ color: '#007bff', marginTop: 0, textAlign: 'left' }}>YMax Contract Control</h3>
      
      <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start' }}>
        {/* Left: Instance Info */}
        <div style={{ flex: '0 0 300px' }}>
          {instanceInfo?.ymax0 && (
            <div style={{ marginBottom: '0.5rem' }}>
              <strong>Instance:</strong> {instanceInfo.ymax0}{' '}
              <button
                onClick={() => navigator.clipboard.writeText(instanceInfo.ymax0!)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0' }}
                title="Copy instance"
              >
                📋
              </button>
            </div>
          )}
          {instanceBlockHeight && (
            <div style={{ color: '#666', fontSize: '0.9em' }}>
              Block height: {instanceBlockHeight}
            </div>
          )}
        </div>

        {/* Right: Actions */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {/* Get Creator Facet */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label style={{ minWidth: '80px', fontWeight: 'bold' }}>Get Facet:</label>
            <input
              type="text"
              value={creatorFacetName}
              onChange={(e) => setCreatorFacetName(e.target.value)}
              placeholder="creatorFacet"
              style={{ 
                flex: 1,
                padding: '0.4rem', 
                border: '1px solid #ccc',
                borderRadius: '4px',
                fontSize: '0.9em'
              }}
            />
            <button 
              onClick={onGetCreatorFacet}
              style={{
                padding: '0.4rem 0.8rem',
                backgroundColor: '#6f42c1',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.9em'
              }}
            >
              Get Creator Facet
            </button>
          </div>

          {/* Terminate */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label style={{ minWidth: '80px', fontWeight: 'bold' }}>Terminate:</label>
            <input
              type="text"
              value={terminateMessage}
              onChange={(e) => setTerminateMessage(e.target.value)}
              placeholder="Optional message"
              style={{ 
                flex: 1,
                padding: '0.4rem', 
                border: '1px solid #ccc',
                borderRadius: '4px',
                fontSize: '0.9em'
              }}
            />
            <button 
              onClick={onTerminate}
              style={{
                padding: '0.4rem 0.8rem',
                backgroundColor: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.9em'
              }}
            >
              Terminate
            </button>
          </div>

          {/* Upgrade */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label style={{ minWidth: '80px', fontWeight: 'bold' }}>Upgrade:</label>
            <input
              type="text"
              value={upgradeBundleId}
              onChange={(e) => setUpgradeBundleId(e.target.value)}
              placeholder="Bundle ID"
              style={{ 
                flex: 1,
                padding: '0.4rem', 
                border: '1px solid #ccc',
                borderRadius: '4px',
                fontSize: '0.9em'
              }}
            />
            <button 
              onClick={onUpgrade}
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
              Upgrade
            </button>
          </div>

          {/* Install and Start */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label style={{ minWidth: '80px', fontWeight: 'bold' }}>Install:</label>
            <input
              type="text"
              value={installBundleId}
              onChange={(e) => setInstallBundleId(e.target.value)}
              placeholder="Bundle ID"
              style={{ 
                flex: 1,
                padding: '0.4rem', 
                border: '1px solid #ccc',
                borderRadius: '4px',
                fontSize: '0.9em'
              }}
            />
            <button 
              onClick={onInstallAndStart}
              style={{
                padding: '0.4rem 0.8rem',
                backgroundColor: '#17a2b8',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.9em'
              }}
            >
              Install & Start
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContractControlCard;
