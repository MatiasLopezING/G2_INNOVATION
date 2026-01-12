import { render, screen } from '@testing-library/react';

test('renders app root container', () => {
  render(<div id="root-test">RecetApp</div>);
  expect(screen.getByText(/RecetApp/i)).toBeTruthy();
});
