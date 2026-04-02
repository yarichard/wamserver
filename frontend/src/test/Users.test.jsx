import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Users from '../components/Users';

describe('Users Component', () => {
  it('renders users list correctly', () => {
    const mockUsers = [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' }
    ];

    render(<Users users={mockUsers} onUpdateUser={vi.fn()} />);

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('does not display user id or password', () => {
    const mockUsers = [{ id: 1, name: 'Alice', password_hash: 'secret' }];

    render(<Users users={mockUsers} onUpdateUser={vi.fn()} />);

    expect(screen.queryByText('ID: 1')).not.toBeInTheDocument();
    expect(screen.queryByText('secret')).not.toBeInTheDocument();
  });

  it('renders empty list when no users provided', () => {
    const { container } = render(<Users users={[]} onUpdateUser={vi.fn()} />);
    const papers = container.querySelectorAll('.MuiPaper-root');
    expect(papers).toHaveLength(0);
  });

  it('renders correct number of user cards', () => {
    const mockUsers = [
      { id: 1, name: 'User 1' },
      { id: 2, name: 'User 2' },
      { id: 3, name: 'User 3' }
    ];

    const { container } = render(<Users users={mockUsers} onUpdateUser={vi.fn()} />);
    const papers = container.querySelectorAll('.MuiPaper-root');
    expect(papers).toHaveLength(3);
  });

  it('shows edit form when edit button is clicked', () => {
    const mockUsers = [{ id: 1, name: 'Alice' }];

    render(<Users users={mockUsers} onUpdateUser={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'edit' }));

    expect(screen.getByLabelText('Name')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('calls onUpdateUser with new name on save', async () => {
    const mockOnUpdateUser = vi.fn().mockResolvedValue();
    const mockUsers = [{ id: 1, name: 'Alice' }];

    render(<Users users={mockUsers} onUpdateUser={mockOnUpdateUser} />);

    fireEvent.click(screen.getByRole('button', { name: 'edit' }));

    const input = screen.getByLabelText('Name');
    fireEvent.change(input, { target: { value: 'Alicia' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(mockOnUpdateUser).toHaveBeenCalledWith(1, 'Alicia');
    });
  });

  it('cancels edit without calling onUpdateUser', () => {
    const mockOnUpdateUser = vi.fn();
    const mockUsers = [{ id: 1, name: 'Alice' }];

    render(<Users users={mockUsers} onUpdateUser={mockOnUpdateUser} />);

    fireEvent.click(screen.getByRole('button', { name: 'edit' }));
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    expect(mockOnUpdateUser).not.toHaveBeenCalled();
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });
});
