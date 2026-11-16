import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Modal } from '../ui';

let rerenderParent: () => void = () => {};

function Harness({ onClose }: { onClose: () => void }) {
  const [, setTick] = useState(0);
  rerenderParent = () => setTick((t) => t + 1);
  // Inline arrow: a new function on every render (the common real-world pattern).
  return (
    <Modal open title="Test" onClose={() => onClose()}>
      <input aria-label="first" />
      <input aria-label="second" />
    </Modal>
  );
}

describe('Modal', () => {
  it('keeps focus where the user is when the parent re-renders', async () => {
    const user = userEvent.setup();
    render(<Harness onClose={() => {}} />);
    await user.click(screen.getByLabelText('second'));
    act(() => rerenderParent());
    expect(screen.getByLabelText('second')).toHaveFocus();
  });

  it('closes on Escape with the latest handler and traps Tab focus', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    expect(screen.getByLabelText('first')).toHaveFocus();
    await user.tab(); // → second
    await user.tab(); // → wraps to the close button (first focusable in the dialog)
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
    await user.tab({ shift: true }); // ← wraps back to last
    expect(screen.getByLabelText('second')).toHaveFocus();
    act(() => rerenderParent());
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
