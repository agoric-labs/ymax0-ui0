import './installSesLockdown';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import App from './App';

describe('App.tsx', () => {
  it('renders app title', async () => {
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    );

    const titleElement = await screen.findByText('ymax-dev-ui', {
      selector: 'h1',
    });
    expect(titleElement).toBeTruthy();
  });

  it('renders the wallet connection button', async () => {
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    );
    const buttonEl = await screen.findByRole('button', {
      name: 'Connect Wallet',
    });
    expect(buttonEl).toBeTruthy();
  });
});
