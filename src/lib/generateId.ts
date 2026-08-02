import { doc, runTransaction, collection, addDoc, serverTimestamp } from 'firebase/firestore';

export async function generateUniqueId(db: any, objectType: string, objectReference: string): Promise<string> {
  let uniqueId = '';
  let isUnique = false;
  
  while (!isUnique) {
    // Generate exactly 9 digit string (allow leading zero, but let's just make sure it's 9 digits)
    // To allow leading zero and be truly random from 000000000 to 999999999:
    uniqueId = Math.floor(Math.random() * 1000000000).toString().padStart(9, '0');
    
    const idRef = doc(db, 'global_ids', uniqueId);
    
    try {
      await runTransaction(db, async (transaction) => {
        const idDoc = await transaction.get(idRef);
        if (!idDoc.exists()) {
          // It's unique! Reserve it
          transaction.set(idRef, { 
            numericId: uniqueId,
            objectType: objectType,
            objectReference: objectReference,
            status: 'reserved',
            createdAt: new Date().toISOString()
          });
          isUnique = true;
        }
      });

      if (isUnique) {
        // Log the ID reservation
        await addDoc(collection(db, 'audit_logs'), {
          action: 'ID_RESERVED',
          numericId: uniqueId,
          objectType: objectType,
          objectReference: objectReference,
          timestamp: serverTimestamp(),
          systemAction: true
        });
      }
    } catch (e) {
      console.warn("ID collision or transaction failed, retrying...", e);
    }
  }
  return uniqueId;
}
