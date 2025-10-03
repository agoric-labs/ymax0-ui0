import { useState } from 'react';
import { MovementDesc } from '../ymax-client';

export type StepInfo = {
  id: string;
  name: string;
  description: string;
  required?: boolean;
  movement?: MovementDesc;
};

type StepSelectorProps = {
  title: string;
  steps: StepInfo[];
  onSelectionChange: (selectedStepIds: string[]) => void;
  className?: string;
};

export const StepSelector = ({
  title,
  steps,
  onSelectionChange,
  className = '',
}: StepSelectorProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedSteps, setSelectedSteps] = useState<Set<string>>(
    new Set(steps.map(step => step.id))
  );

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
    const allSteps = new Set(steps.map(step => step.id));
    setSelectedSteps(allSteps);
    onSelectionChange(Array.from(allSteps));
  };

  const deselectAll = () => {
    const emptySteps = new Set<string>();
    setSelectedSteps(emptySteps);
    onSelectionChange(Array.from(emptySteps));
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
            {steps.map((step, index) => (
              <div key={step.id} className="step-item">
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

          {selectedSteps.size < steps.length && (
            <div className="step-warning">
              <span className="warning-icon">⚠️</span>
              Some steps are deselected. This may affect the transaction flow.
            </div>
          )}
        </div>
      )}
    </div>
  );
};