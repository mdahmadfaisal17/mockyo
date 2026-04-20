const DB_NAME = "mockyo-editor";
const STORE_NAME = "workspaces";
const DB_VERSION = 1;

const openDatabase = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("IndexedDB is not available."));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error || new Error("Failed to open IndexedDB."));
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });

const withStore = async <T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> => {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    const request = action(store);

    request.onerror = () => reject(request.error || new Error("IndexedDB request failed."));
    request.onsuccess = () => resolve(request.result);

    transaction.oncomplete = () => db.close();
    transaction.onerror = () => reject(transaction.error || new Error("IndexedDB transaction failed."));
    transaction.onabort = () => reject(transaction.error || new Error("IndexedDB transaction aborted."));
  });
};

export const readEditorWorkspace = async <T>(key: string): Promise<T | null> => {
  const result = await withStore<unknown>("readonly", (store) => store.get(key));
  return (result as T | undefined) ?? null;
};

export const writeEditorWorkspace = async <T>(key: string, value: T): Promise<void> => {
  await withStore("readwrite", (store) => store.put(value, key));
};

export const removeEditorWorkspace = async (key: string): Promise<void> => {
  await withStore("readwrite", (store) => store.delete(key));
};