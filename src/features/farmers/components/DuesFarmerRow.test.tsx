import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DuesFarmerRow from './DuesFarmerRow';
import type { Farmer } from '@/types/database';

const farmer = { id: 'f1', name: 'Ravi Kumar', total_due: 5000, follow_up_date: null, village: 'Kakinada', image_url: null } as Farmer;

describe('DuesFarmerRow', () => {
  it('calls onCollect with the farmer when the collect button is tapped', () => {
    const onCollect = vi.fn();
    render(
      <MemoryRouter>
        <DuesFarmerRow farmer={farmer} oldestDueDays={10} onFollowUp={vi.fn()} onCollect={onCollect} />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByLabelText('Collect payment from Ravi Kumar'));
    expect(onCollect).toHaveBeenCalledWith(farmer);
  });
});
