import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
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

describe('Change Password', () => {
  const mockUsers = [
    { id: 1, name: 'Alice' },
    { id: 2, name: 'Bob' },
  ];

  it('shows change password button only for currentUserId', () => {
    render(<Users users={mockUsers} onUpdateUser={vi.fn()} currentUserId={1} />);

    const buttons = screen.getAllByRole('button', { name: 'change password' });
    expect(buttons).toHaveLength(1);
  });

  it('does not show change password button when currentUserId does not match any user', () => {
    render(<Users users={mockUsers} onUpdateUser={vi.fn()} currentUserId={99} />);

    expect(screen.queryByRole('button', { name: 'change password' })).not.toBeInTheDocument();
  });

  it('opens change password dialog when lock button is clicked', () => {
    render(<Users users={mockUsers} onUpdateUser={vi.fn()} currentUserId={1} />);

    fireEvent.click(screen.getByRole('button', { name: 'change password' }));

    expect(screen.getByText('Change Password')).toBeInTheDocument();
    expect(screen.getByLabelText('Current password')).toBeInTheDocument();
    expect(screen.getByLabelText('New password')).toBeInTheDocument();
    expect(screen.getByLabelText('Confirm new password')).toBeInTheDocument();
  });

  it('shows error when any field is empty', async () => {
    render(<Users users={mockUsers} onUpdateUser={vi.fn()} onChangePassword={vi.fn()} currentUserId={1} />);

    fireEvent.click(screen.getByRole('button', { name: 'change password' }));
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(await screen.findByText('All fields are required.')).toBeInTheDocument();
  });

  it('shows error when new passwords do not match', async () => {
    render(<Users users={mockUsers} onUpdateUser={vi.fn()} onChangePassword={vi.fn()} currentUserId={1} />);

    fireEvent.click(screen.getByRole('button', { name: 'change password' }));
    fireEvent.change(screen.getByLabelText('Current password'), { target: { value: 'oldpass123' } });
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'newpass123' } });
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'different123' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(await screen.findByText('New passwords do not match.')).toBeInTheDocument();
  });

  it('shows error when new password is too short', async () => {
    render(<Users users={mockUsers} onUpdateUser={vi.fn()} onChangePassword={vi.fn()} currentUserId={1} />);

    fireEvent.click(screen.getByRole('button', { name: 'change password' }));
    fireEvent.change(screen.getByLabelText('Current password'), { target: { value: 'oldpass123' } });
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'short' } });
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'short' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(await screen.findByText('New password must be at least 8 characters.')).toBeInTheDocument();
  });

  it('shows error when current password is incorrect (401)', async () => {
    const error = { response: { status: 422 } };
    const mockOnChangePassword = vi.fn().mockRejectedValue(error);

    render(<Users users={mockUsers} onUpdateUser={vi.fn()} onChangePassword={mockOnChangePassword} currentUserId={1} />);

    fireEvent.click(screen.getByRole('button', { name: 'change password' }));
    fireEvent.change(screen.getByLabelText('Current password'), { target: { value: 'wrongpass' } });
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'newpass123' } });
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'newpass123' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(await screen.findByText('Current password is incorrect.')).toBeInTheDocument();
  });

  it('closes dialog on successful password change', async () => {
    const mockOnChangePassword = vi.fn().mockResolvedValue();

    render(<Users users={mockUsers} onUpdateUser={vi.fn()} onChangePassword={mockOnChangePassword} currentUserId={1} />);

    fireEvent.click(screen.getByRole('button', { name: 'change password' }));
    fireEvent.change(screen.getByLabelText('Current password'), { target: { value: 'currentpass' } });
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'newpass123' } });
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'newpass123' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(screen.queryByText('Change Password')).not.toBeInTheDocument();
    });
    expect(mockOnChangePassword).toHaveBeenCalledWith(1, 'currentpass', 'newpass123');
  });
});
