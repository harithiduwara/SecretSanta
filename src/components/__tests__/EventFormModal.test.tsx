import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { EventFormModal } from '../EventFormModal';
import { todayIso } from '../../lib/format';

const shift = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return todayIso(d);
};

function setup(initial?: Parameters<typeof EventFormModal>[0]['initial']) {
  const onSubmit = vi.fn();
  render(
    <EventFormModal
      open
      onClose={() => {}}
      onSubmit={onSubmit}
      initial={initial}
      title="T"
      submitLabel="Save"
    />,
  );
  const date = screen.getByLabelText('Exchange date') as HTMLInputElement;
  const setDate = (v: string) => fireEvent.change(date, { target: { value: v } });
  const save = () => userEvent.click(screen.getByRole('button', { name: 'Save' }));
  return { onSubmit, date, setDate, save };
}

describe('EventFormModal date rules', () => {
  it('limits the picker to today onwards', () => {
    expect(setup().date.min).toBe(todayIso());
  });

  it('rejects a past date for a new exchange', async () => {
    const { onSubmit, setDate, save } = setup();
    setDate(shift(-1));
    await save();
    expect(screen.getByText('Choose today or a later date.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('accepts today, a future date, or no date', async () => {
    for (const value of [shift(0), shift(30), '']) {
      const { onSubmit, setDate, save } = setup();
      setDate(value);
      await save();
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ date: value }));
      document.body.innerHTML = '';
    }
  });

  it('lets an exchange keep its own past date but not move to another past date', async () => {
    const past = shift(-40);
    const { onSubmit, setDate, save } = setup({ name: 'Last year', date: past });
    expect(screen.getByText('This date has passed.')).toBeInTheDocument();
    await save();
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ date: past }));
    onSubmit.mockClear();
    setDate(shift(-2));
    await save();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Choose today or a later date.')).toBeInTheDocument();
  });
});
