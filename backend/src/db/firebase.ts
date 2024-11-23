import * as admin from 'firebase-admin';
import path from 'path';
import { getDbConnection } from './mysql';

const serviceAccount = path.join(__dirname, '../../firebase.json');

// Cache for Firebase instances
const firebaseApps: Record<number, admin.app.App> = {};

// Function to retrieve Firebase instance URL from the `firebase_instance` table
async function getFirebaseConfig(instance: number): Promise<{ databaseURL: string }> {
  const connection = await getDbConnection().getConnection(); // Get a connection from the pool

  try {
    const [rows] = await connection.execute(
      'SELECT URL as databaseURL FROM firebase_instance WHERE id = ?',
      [instance],
    ) as any;

    if (rows.length > 0) {
      return { databaseURL: rows[0].databaseURL };
    } else {
      throw new Error(`Firebase config not found for instance ${instance}.`);
    }
  } finally {
    connection.release(); // Release the connection back to the pool
  }
}

// Initialize Firebase app instances dynamically
async function initializeFirebaseApp(instance: number): Promise<admin.app.App> {
  if (!firebaseApps[instance]) {
    const config = await getFirebaseConfig(instance);
    firebaseApps[instance] = admin.initializeApp(
      {
        credential: admin.credential.cert(serviceAccount),
        databaseURL: config.databaseURL,
      },
      `app${instance}`,
    );
  }
  return firebaseApps[instance];
}

// Function to get the Firebase Database instance by app number
export const getFirebaseDb = async (instance: number) => {
  const app = await initializeFirebaseApp(instance);
  return app.database();
};

// Function to close and clean up a Firebase instance by app number
export function closeFirebaseApp(instance: number): void {
  if (firebaseApps[instance]) {
    firebaseApps[instance].delete()
      .then(() => {
        console.log(`Firebase app instance ${instance} closed successfully.`);
        delete firebaseApps[instance];
      })
      .catch(error => {
        console.error(`Error closing Firebase app instance ${instance}:`, error);
      });
  }
}
