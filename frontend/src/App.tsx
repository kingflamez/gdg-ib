import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { initializeApp } from "firebase/app";
import { getDatabase, ref, onValue, remove } from "firebase/database";
import { useNavigate, useSearchParams } from "react-router-dom";
import "./App.css";

interface Transaction {
  id: number;
  pos_id: string;
  amount: number;
  beneficiary: string;
  bank_name: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

interface PosResponse {
  pos_id: number;
  account_name: string;
  account_number: string;
  firebase_db_url: string;
}

// Add this helper function at the top of the file, before the App component
const formatDateTime = (dateString: string) => {
  const date = new Date(dateString);
  
  // Format date
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  
  // Format time
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  
  return `${day}/${month}/${year} ${hours}:${minutes}`;
};

function App() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [accountDetails, setAccountDetails] = useState<PosResponse | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processedKeys] = useState(new Set<string>());

  const processFirebaseTransaction = useCallback(async (
    firebaseKey: string,
    transaction: Omit<Transaction, 'id'>,
    posId: string,
    database: any
  ) => {
    // Skip if we've already processed this transaction
    if (processedKeys.has(firebaseKey)) {
      return;
    }

    try {
      if (parseInt(transaction.pos_id) === parseInt(posId)) {
        // Mark as processed immediately
        processedKeys.add(firebaseKey);

        // Update state with new transaction
        setTransactions(prev => {
          // Check if transaction already exists in the array
          const exists = prev.some(t => 
            t.beneficiary === transaction.beneficiary && 
            t.amount === transaction.amount &&
            t.created_at === transaction.created_at
          );
          
          if (exists) {
            return prev;
          }
          return [transaction as Transaction, ...prev];
        });

        // Remove from Firebase
        const transactionRef = ref(database, `transactions/${firebaseKey}`);
        await remove(transactionRef);
      }
    } catch (err) {
      console.error('Error processing Firebase transaction:', err);
    }
  }, [processedKeys]);

  useEffect(() => {
    const posId = searchParams.get('pos-id') || '1';
    
    if (!searchParams.get('pos-id')) {
      navigate('/?pos-id=1', { replace: true });
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        // Fetch POS details
        const posResponse = await axios.get<PosResponse>(
          `http://localhost:3000/api/v1/pos/${posId}`
        );
        
        setAccountDetails(posResponse.data);
        
        // Fetch transactions
        const transactionsResponse = await axios.get<Transaction[]>(
          `http://localhost:3000/api/v1/pos/${posId}/transactions`
        );
        
        setTransactions(transactionsResponse.data);
        
        initializeFirebase(posResponse.data.firebase_db_url, posId);
      } catch (err) {
        setError('Failed to fetch data');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [searchParams, navigate, processFirebaseTransaction]);

  const initializeFirebase = (databaseURL: string, posId: string) => {
    const firebaseConfig = {
      databaseURL: databaseURL,
    };

    const app = initializeApp(firebaseConfig);
    const database = getDatabase(app);
    
    // Listen to transactions in Firebase
    const transactionsRef = ref(database, 'transactions');
    onValue(transactionsRef, async (snapshot) => {
      const data = snapshot.val();
      if (data) {
        // Process transactions sequentially to avoid race conditions
        for (const [firebaseKey, transaction] of Object.entries(data)) {
          await processFirebaseTransaction(
            firebaseKey,
            transaction as Omit<Transaction, 'id'>,
            posId,
            database
          );
        }
      }
    });
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (error) {
    return <div className="error">{error}</div>;
  }

  return (
    <div className="App">
      <div className="account-details">
        <h2>Account Information</h2>
        <div className="account-info">
          <p><strong>Account Number:</strong> {accountDetails?.account_number}</p>
          <p><strong>Account Name:</strong> {accountDetails?.account_name}</p>
          <p><strong>Bank Name:</strong> Moniepoint MFB</p>
        </div>
      </div>

      <div className="transactions">
        <h2>Recent Transactions</h2>
        <div className="transactions-list">
          {transactions.length === 0 ? (
            <div className="no-transactions">No transactions found</div>
          ) : (
            transactions.map((transaction) => (
              <div key={transaction.id} className="transaction-item">
                <div className="transaction-main">
                  <span className="beneficiary">{transaction.beneficiary}</span>
                  <span className="amount">₦{(transaction.amount/100).toLocaleString()}</span>
                </div>
                <div className="transaction-details">
                  <span className="bank">{transaction.bank_name}</span>
                  <span className="date">
                    {formatDateTime(transaction.created_at)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
