import express from 'express';
import { getDbConnection } from '../db/mysql';
import { pipeline } from 'stream';
import { Transaction } from './transactionHelpers';
import { promisify } from 'util';

const router = express.Router();
const streamPipeline = promisify(pipeline);

interface POS {
  terminalId: string;
  accountNumber: string;
  firebaseInstance: string;
  firebase_db_url: string;
}

// Get POS details by terminalId
router.get<{ id: string }, POS | { error: string }>(
  '/:id',
  async (req, res) => {
    const connection = await getDbConnection().getConnection(); // Get a connection from the pool
    try {
      const { id } = req.params;

      const [result] = (await connection.execute(
        `SELECT pos.id AS pos_id, pos.account_name as account_name, pos.account_number as account_number, firebase_instance.url as firebase_db_url
          FROM pos
          JOIN firebase_instance ON pos.firebase_instance_id = firebase_instance.id
          WHERE pos.id = ?`,
        [id],
      )) as any;

      if (result.length === 0) {
        return res.status(404).json({ error: 'POS terminal not found' });
      }

      const posData = result[0];

      res.json(posData);
    } catch (error) {
      console.error('Error fetching POS details:', error);
      res.status(500).json({ error: 'Internal server error' });
    } finally {
      connection.release(); // Release the connection back to the pool
    }
  },
);

// GET endpoint
router.get<{ id: string }, Transaction[] | { error: string }>(
  '/:id/transactions',
  async (req, res) => {
    const connection = await getDbConnection().getConnection(); // Get a connection from the pool
    try {
      const { id } = req.params;

      const query = `
        SELECT t.* 
        FROM transactions t
        WHERE t.pos_id = ?
        ORDER BY t.id DESC
      `;

      const [transactions] = (await connection.execute(query, [id])) as any;

      res.json(transactions);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      res.status(500).json({ error: 'Internal server error' });
    } finally {
      connection.release(); // Release the connection back to the pool
    }
  },
);

// Add this new endpoint before the export
router.get('/files/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const fileUrl = `https://files-service.development.moniepoint.com/view/${id}`;

    // Proxy the request to the files service
    const response = await fetch(fileUrl);

    if (!response.ok) {
      return res.status(response.status).json({
        error: `Failed to fetch file: ${response.statusText}`, 
      });
    }

    // Forward the content type header
    const contentType = response.headers.get('content-type');
    if (contentType) {
      res.setHeader('Content-Type', contentType);
    }

    // Stream the response directly to the client
    if (response.body) {
      await streamPipeline(response.body, res);
    } else {
      res.status(500).json({ error: 'No response body available' });
    }
  } catch (error) {
    console.error('Error proxying file:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
