import { useEffect, useState } from 'react';
import { Paper, Typography } from '@mui/material';
import axios from 'axios';

function KafkaParams() {
  const [kafkaParams, setKafkaParams] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchParams = async () => {
      try {
        const response = await axios.get('/api/parameters');
        setKafkaParams(response.data);
        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    };

    fetchParams();
  }, []);

  if (loading) {
    return (
      <Paper elevation={2} sx={{ p: 3, flex: 1 }}>
        <Typography variant="h5" gutterBottom>
          Kafka Configuration
        </Typography>
        <Typography color="text.secondary">Loading configuration...</Typography>
      </Paper>
    );
  }

  if (error) {
    return (
      <Paper elevation={2} sx={{ p: 3, flex: 1 }}>
        <Typography variant="h5" gutterBottom>
          Kafka Configuration
        </Typography>
        <Typography color="error">Error: {error}</Typography>
      </Paper>
    );
  }

  return (
    <Paper elevation={2} sx={{ p: 3, flex: 1 }}>
      <Typography variant="h5" gutterBottom>
        Kafka Configuration
      </Typography>
      <Typography><strong>URL:</strong> {kafkaParams.kafka_url}</Typography>
      <Typography><strong>Topic:</strong> {kafkaParams.kafka_topic}</Typography>
      <Typography><strong>Group:</strong> {kafkaParams.kafka_group}</Typography>
    </Paper>
  );
}

export default KafkaParams;
