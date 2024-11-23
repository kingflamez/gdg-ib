import express from 'express';
import { getDbConnection } from '../db/mysql';
import { closeFirebaseApp, getFirebaseDb } from '../db/firebase';
import {
  isValidTransactionInput,
  generateBeneficiaryName,
  getRandomElement,
  BANK_NAMES,
} from './transactionHelpers';

const router = express.Router();

// POST endpoint
router.post('/', async (req, res) => {
  const connection = await getDbConnection().getConnection(); // Get a connection from the pool
  let firebaseInstance: number | null = null;
  try {
    const { id, amount } = req.body;

    // Input validation
    if (!isValidTransactionInput(id, amount)) {
      return res.status(400).json({
        error: 'Invalid input. id and positive amount are required',
      });
    }

    // First, verify if the POS terminal exists and get its ID
    const [posResult] = (await connection.execute(
      'SELECT id, firebase_instance_id FROM pos WHERE id = ?',
      [id],
    )) as any;

    if (posResult.length === 0) {
      return res.status(404).json({ error: 'POS terminal not found' });
    }

    const posId = posResult[0].id;
    firebaseInstance = posResult[0].firebase_instance_id;

    // Generate random data
    const beneficiary = generateBeneficiaryName();
    const bankName = getRandomElement(BANK_NAMES);

    const query = `
      INSERT INTO transactions (
        pos_id,
        amount,
        beneficiary,
        bank_name
      ) VALUES (?, ?, ?, ?)
    `;

    const [result] = (await connection.execute(query, [
      posId,
      amount, // credit
      beneficiary,
      bankName,
    ])) as any;

    // Fetch the created transaction
    const [newTransaction] = (await connection.execute(
      'SELECT * FROM transactions WHERE id = ?',
      [result.insertId],
    )) as any;

    const firebase = await getFirebaseDb(firebaseInstance!);

    const transaction = newTransaction[0];
    await firebase.ref(`transactions/${transaction.id}`).set(transaction);

    res.status(201).json(transaction);
  } catch (error) {
    console.error('Error creating transaction:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    connection.release(); // Release the connection back to the pool
    if (firebaseInstance) {
      closeFirebaseApp(firebaseInstance);
    }
  }
});

export default router;
