import { get, set } from 'idb-keyval';

export type MutationTask = {
  id: string;
  type: string;
  payload: any;
  timestamp: number;
};

const QUEUE_KEY = 'offline_mutation_queue';

export const getOfflineQueue = async (): Promise<MutationTask[]> => {
  return (await get(QUEUE_KEY)) || [];
};

export const enqueueOfflineMutation = async (task: Omit<MutationTask, 'id' | 'timestamp'>) => {
  const queue = await getOfflineQueue();
  const newTask: MutationTask = {
    ...task,
    id: crypto.randomUUID(),
    timestamp: Date.now(),
  };
  await set(QUEUE_KEY, [...queue, newTask]);
  return newTask;
};

export const dequeueOfflineMutation = async (id: string) => {
  const queue = await getOfflineQueue();
  await set(QUEUE_KEY, queue.filter((t) => t.id !== id));
};

export const clearOfflineQueue = async () => {
  await set(QUEUE_KEY, []);
};
