import { initClient, updateClient } from '@ton-api/client';

const baseUrl = 'https://tonapi.io';

// Initialize default client (without API key)
export function initTa() {
    initClient({ baseUrl });
}

// Initialize client with API key
export function initTaWithApiKey() {
    initClient({
        baseUrl,
        apiKey: 'TEST_API_KEY'
    });
}

// Switch to client without API key
export function useTa() {
    updateClient({ apiKey: undefined });
}

// Switch to client with API key
export function useTaWithApiKey() {
    updateClient({ apiKey: 'TEST_API_KEY' });
}

// Initialize default client on module load
initTa();
