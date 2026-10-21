export const API_URL = import.meta.env.VITE_API_URL || '/api';

export async function request(path, options = {}, token) {
  const { timeout = 120000, ...fetchOptions } = options;
  const response = await fetch(`${API_URL}${path}`, { ...fetchOptions, headers: { ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers }, signal: AbortSignal.timeout(timeout) });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.message || 'Request failed. Please try again.');
  return result;
}
export async function liveMutation(operation, payload, token) {
  const routes = {
    transaction: [payload._id ? `/transactions/${payload._id}` : '/transactions', payload._id ? 'PUT' : 'POST'],
    deleteTransaction: [`/transactions/${payload.id}`, 'DELETE'], account: ['/accounts', 'POST'], budget: ['/budget', 'PUT'], profile: ['/profile', 'PUT'], group: ['/groups', 'POST'], message: [`/groups/${payload.groupId}/messages`, 'POST'], split: [`/groups/${payload.groupId}/splits`, 'POST'], settle: [`/splits/${payload.id}`, 'PUT'], import: ['/statements/import', 'POST'],
  };
  const [path, method] = routes[operation];
  let body;
  if (operation === 'transaction' && payload.image instanceof File) {
    body = new FormData();
    Object.entries(payload).forEach(([key, value]) => { if (value != null) body.append(key, value); });
  } else if (method !== 'DELETE') body = JSON.stringify(payload);
  await request(`/workspace${path}`, { method, ...(body ? { body } : {}) }, token);
  return request('/workspace', {}, token);
}
export function downloadFile(name, content, type = 'text/csv') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function exportCsv(transactions) {
  const escape = value => `"${String(value ?? '').replace(/^[=+\-@\t\r]/, "'$&").replaceAll('"', '""')}"`;
  downloadFile('finsight-transactions.csv', ['date,description,amount,type,category', ...transactions.map(t => [t.date.slice(0, 10), t.title, t.amount, t.transactionType.toUpperCase(), t.category].map(escape).join(','))].join('\r\n'));
}
