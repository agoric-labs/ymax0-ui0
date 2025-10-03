import { useState, useEffect } from 'react';
import { MovementDesc } from '../ymax-client';

// Type for Brand from ERTP
type Brand<T extends 'nat' | 'set'> = {
  readonly brand: unique symbol;
};

export type StepInfo = {
  id: string;
  name: string;
  description: string;
  required?: boolean;
  movement?: MovementDesc;
  custom?: boolean; // Flag to identify custom steps
};

// Available sources and destinations for custom steps
const STEP_PLACES = [
  // Seat keywords
  '<Cash>',
  '<Deposit>',
  // Chain references
  '@agoric',
  '@noble',
  '@Avalanche',
  '@Arbitrum',
  '@Ethereum',
  '@Base',
  '@Optimism',
  // Pool places
  'USDN',
  'USDNVault',
  'Aave_Avalanche',
  'Aave_Arbitrum', 
  'Aave_Ethereum',
  'Aave_Base',
  'Aave_Optimism',
  'Compound_Ethereum',
  'Compound_Optimism',
  'Compound_Arbitrum',
  'Compound_Base',
] as const;

type StepSelectorProps = {
  title: string;
  steps: StepInfo[];
  onSelectionChange: (selectedStepIds: string[]) => void;
  onStepsReorder?: (reorderedSteps: StepInfo[]) => void;
  onAddCustomStep?: (newStep: StepInfo) => void;
  defaultAmount?: string; // Default amount for custom steps
  className?: string;
};

export const StepSelector = ({
  title,
  steps,
  onSelectionChange,
  onStepsReorder,
  onAddCustomStep,
  defaultAmount = '1.0',
  className = '',
}: StepSelectorProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedSteps, setSelectedSteps] = useState<Set<string>>(
    new Set(steps.map(step => step.id))
  );
  const [orderedSteps, setOrderedSteps] = useState<StepInfo[]>(steps);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Custom step form state
  const [showAddStepForm, setShowAddStepForm] = useState(false);
  const [customStepSource, setCustomStepSource] = useState<string>('<Deposit>');
  const [customStepDestination, setCustomStepDestination] = useState<string>('@agoric');
  const [customStepAmount, setCustomStepAmount] = useState<string>(defaultAmount);

  // Update ordered steps when props change
  useEffect(() => {
    setOrderedSteps(steps);
  }, [steps]);

  // Update custom step amount when defaultAmount changes
  useEffect(() => {
    if (!showAddStepForm) {
      setCustomStepAmount(defaultAmount);
    }
  }, [defaultAmount, showAddStepForm]);

  const toggleStep = (stepId: string) => {
    const newSelection = new Set(selectedSteps);
    if (newSelection.has(stepId)) {
      newSelection.delete(stepId);
    } else {
      newSelection.add(stepId);
    }
    setSelectedSteps(newSelection);
    onSelectionChange(Array.from(newSelection));
  };

  const selectAll = () => {
    const allSteps = new Set(orderedSteps.map(step => step.id));
    setSelectedSteps(allSteps);
    onSelectionChange(Array.from(allSteps));
  };

  const deselectAll = () => {
    const emptySteps = new Set<string>();
    setSelectedSteps(emptySteps);
    onSelectionChange(Array.from(emptySteps));
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', '');
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    if (draggedIndex === null || draggedIndex === index) {
      return;
    }

    // Real-time reordering during drag
    const newSteps = [...orderedSteps];
    const draggedStep = newSteps[draggedIndex];
    
    // Remove dragged item from its current position
    newSteps.splice(draggedIndex, 1);
    
    // Insert at new position
    newSteps.splice(index, 0, draggedStep);
    
    setOrderedSteps(newSteps);
    setDraggedIndex(index); // Update dragged index to new position
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    // Don't clear dragOverIndex immediately as it causes flickering
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    setDraggedIndex(null);
    setDragOverIndex(null);
    
    // Notify parent of reorder if callback provided
    if (onStepsReorder) {
      onStepsReorder(orderedSteps);
    }
    
    // Update selection to maintain selected step IDs in new order
    onSelectionChange(Array.from(selectedSteps));
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleAddCustomStep = () => {
    if (!customStepSource || !customStepDestination || !onAddCustomStep) {
      return;
    }

    // Generate unique ID for custom step
    const customStepId = `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Parse amount as USDC (6 decimals)
    const amountValue = BigInt(Math.floor(parseFloat(customStepAmount) * 1_000_000));
    
    const newStep: StepInfo = {
      id: customStepId,
      name: `Custom: ${customStepSource} → ${customStepDestination}`,
      description: `Transfer ${customStepAmount} USDC from ${customStepSource} to ${customStepDestination}`,
      custom: true,
      movement: {
        src: customStepSource,
        dest: customStepDestination,
        amount: {
          brand: {} as Brand<'nat'>, // Will be filled by parent
          value: amountValue,
        },
      },
    };

    // Add to ordered steps
    const newOrderedSteps = [...orderedSteps, newStep];
    setOrderedSteps(newOrderedSteps);
    
    // Add to selected steps by default
    const newSelectedSteps = new Set([...selectedSteps, customStepId]);
    setSelectedSteps(newSelectedSteps);
    
    // Notify parent
    onAddCustomStep(newStep);
    if (onStepsReorder) {
      onStepsReorder(newOrderedSteps);
    }
    onSelectionChange(Array.from(newSelectedSteps));

    // Reset form
    setCustomStepAmount(defaultAmount);
    setShowAddStepForm(false);
  };

  const handleCancelAddStep = () => {
    setShowAddStepForm(false);
    setCustomStepSource('<Deposit>');
    setCustomStepDestination('@agoric');
    setCustomStepAmount(defaultAmount);
  };

  return (
    <div className={`step-selector ${className}`}>
      <div className="step-selector-header">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="step-toggle-button"
          type="button"
        >
          <span className="step-toggle-icon">
            {isExpanded ? '▼' : '▶'}
          </span>
          {title} ({selectedSteps.size}/{steps.length} steps selected)
        </button>
      </div>

      {isExpanded && (
        <div className="step-selector-content">
          <div className="step-selector-controls">
            <button onClick={selectAll} className="step-control-button">
              Select All
            </button>
            <button onClick={deselectAll} className="step-control-button">
              Deselect All
            </button>
          </div>

          <div className="step-list">
            {orderedSteps.map((step, index) => (
              <div 
                key={step.id} 
                className={`step-item ${draggedIndex === index ? 'dragging' : ''} ${dragOverIndex === index ? 'drag-over' : ''}`}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={(e) => handleDrop(e, index)}
              >
                <div 
                  className="drag-handle"
                  draggable={true}
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragEnd={handleDragEnd}
                >
                  <span className="drag-icon">⋮⋮</span>
                </div>
                <label className="step-item-label">
                  <input
                    type="checkbox"
                    checked={selectedSteps.has(step.id)}
                    onChange={() => toggleStep(step.id)}
                    className="step-checkbox"
                  />
                  <div className="step-info">
                    <div className="step-name">
                      {index + 1}. {step.name}
                    </div>
                    <div className="step-description">{step.description}</div>
                    {step.movement && (
                      <div className="step-movement">
                        {step.movement.src} → {step.movement.dest}
                        {step.movement.fee && (
                          <span className="step-fee"> (fee required)</span>
                        )}
                      </div>
                    )}
                  </div>
                </label>
              </div>
            ))}
          </div>

          {selectedSteps.size < orderedSteps.length && (
            <div className="step-warning">
              <span className="warning-icon">⚠️</span>
              Some steps are deselected. This may affect the transaction flow.
            </div>
          )}

          {/* Add Custom Step Section */}
          <div className="add-step-section">
            {!showAddStepForm ? (
              <button
                onClick={() => setShowAddStepForm(true)}
                className="add-step-button"
                type="button"
              >
                <span className="add-step-icon">+</span>
                Add Custom Step
              </button>
            ) : (
              <div className="add-step-form">
                <h4 className="add-step-title">Add Custom Step</h4>
                
                <div className="add-step-inputs">
                  <div className="add-step-input-group">
                    <label htmlFor="step-source">From:</label>
                    <select
                      id="step-source"
                      value={customStepSource}
                      onChange={(e) => setCustomStepSource(e.target.value)}
                      className="add-step-select"
                    >
                      {STEP_PLACES.map(place => (
                        <option key={place} value={place}>
                          {place}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="add-step-arrow">→</div>

                  <div className="add-step-input-group">
                    <label htmlFor="step-destination">To:</label>
                    <select
                      id="step-destination"
                      value={customStepDestination}
                      onChange={(e) => setCustomStepDestination(e.target.value)}
                      className="add-step-select"
                    >
                      {STEP_PLACES.map(place => (
                        <option key={place} value={place}>
                          {place}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="add-step-input-group">
                    <label htmlFor="step-amount">Amount (USDC):</label>
                    <input
                      id="step-amount"
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={customStepAmount}
                      onChange={(e) => setCustomStepAmount(e.target.value)}
                      className="add-step-input"
                      placeholder={defaultAmount}
                    />
                  </div>
                </div>

                <div className="add-step-actions">
                  <button
                    onClick={handleAddCustomStep}
                    className="add-step-confirm"
                    type="button"
                    disabled={!customStepSource || !customStepDestination || !customStepAmount}
                  >
                    Add Step
                  </button>
                  <button
                    onClick={handleCancelAddStep}
                    className="add-step-cancel"
                    type="button"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};