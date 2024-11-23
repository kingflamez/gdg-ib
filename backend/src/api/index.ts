import express from 'express';
import posRouter from './pos';
import transactionsRouter from './transactions';

const router = express.Router();

router.use('/pos', posRouter);
router.use('/transactions', transactionsRouter);

export default router;