import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import Users from '../components/Users';

describe('Users Component', () => {
  it('renders users list correctly', () => {
    const mockUsers = [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' }
    ];

    render(<Users users={mockUsers} />);

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('ID: 1')).toBeInTheDocument();
    expect(screen.getByText('ID: 2')).toBeInTheDocument();
  });

  it('renders empty list when no users provided', () => {
    const { container } = render(<Users users={[]} />);
    const papers = container.querySelectorAll('.MuiPaper-root');
    expect(papers).toHaveLength(0);
  });

  it('renders correct number of user cards', () => {
    const mockUsers = [
      { id: 1, name: 'User 1' },
      { id: 2, name: 'User 2' },
      { id: 3, name: 'User 3' }
    ];

    const { container } = render(<Users users={mockUsers} />);
    const papers = container.querySelectorAll('.MuiPaper-root');
    expect(papers).toHaveLength(3);
  });
});
