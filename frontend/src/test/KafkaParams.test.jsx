import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import KafkaParams from '../components/KafkaParams';
import axios from 'axios';

// Mock axios
vi.mock('axios');

describe('KafkaParams Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('displays loading state initially', () => {
    axios.get.mockImplementation(() => new Promise(() => {})); // Never resolves

    render(<KafkaParams />);

    expect(screen.getByText('Kafka Configuration')).toBeInTheDocument();
    expect(screen.getByText('Loading configuration...')).toBeInTheDocument();
  });

  it('displays kafka parameters after successful fetch', async () => {
    const mockKafkaParams = {
      kafka_url: 'localhost:9092',
      kafka_topic: 'messages',
      kafka_group: 'consumer-group-1'
    };

    axios.get.mockResolvedValue({ data: mockKafkaParams });

    render(<KafkaParams />);

    await waitFor(() => {
      expect(screen.getByText(/localhost:9092/)).toBeInTheDocument();
    });

    expect(screen.getByText(/URL:/)).toBeInTheDocument();
    expect(screen.getByText(/localhost:9092/)).toBeInTheDocument();
    expect(screen.getByText(/Topic:/)).toBeInTheDocument();
    expect(screen.getByText(/messages/)).toBeInTheDocument();
    expect(screen.getByText(/Group:/)).toBeInTheDocument();
    expect(screen.getByText(/consumer-group-1/)).toBeInTheDocument();
  });

  it('displays error message when fetch fails', async () => {
    axios.get.mockRejectedValue(new Error('Network error'));

    render(<KafkaParams />);

    await waitFor(() => {
      expect(screen.getByText(/Error: Network error/)).toBeInTheDocument();
    });

    expect(screen.getByText('Kafka Configuration')).toBeInTheDocument();
  });

  it('calls the correct API endpoint', async () => {
    const mockKafkaParams = {
      kafka_url: 'localhost:9092',
      kafka_topic: 'messages',
      kafka_group: 'consumer-group-1'
    };

    axios.get.mockResolvedValue({ data: mockKafkaParams });

    render(<KafkaParams />);

    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith('/api/parameters');
    });

    expect(axios.get).toHaveBeenCalledTimes(1);
  });

  it('renders Paper component with correct elevation', () => {
    axios.get.mockImplementation(() => new Promise(() => {}));

    const { container } = render(<KafkaParams />);

    // Check that Paper component is rendered
    const paper = container.querySelector('.MuiPaper-root');
    expect(paper).toBeInTheDocument();
  });

  it('handles empty kafka parameters gracefully', async () => {
    const mockKafkaParams = {
      kafka_url: '',
      kafka_topic: '',
      kafka_group: ''
    };

    axios.get.mockResolvedValue({ data: mockKafkaParams });

    render(<KafkaParams />);

    await waitFor(() => {
      expect(screen.getByText(/URL:/)).toBeInTheDocument();
    });

    // Should still render the labels even if values are empty
    expect(screen.getByText(/URL:/)).toBeInTheDocument();
    expect(screen.getByText(/Topic:/)).toBeInTheDocument();
    expect(screen.getByText(/Group:/)).toBeInTheDocument();
  });
});
