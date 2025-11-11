import { initClient, status, getAccounts as getAccountsOp, getAccountPublicKey, getAccount } from '@ton-api/client';
import { initTa, useTa, useTaWithApiKey } from './utils/client';
import { Address } from '@ton/core';
import { getAccounts } from './__mock__/services';
import { vi, test, expect, afterEach, beforeEach, describe } from 'vitest';
import { mockFetch } from './utils/mockFetch';

beforeEach(() => {
    initTa();
    vi.restoreAllMocks();
});

afterEach(() => {
    vi.restoreAllMocks();
});

test('Client status test', async () => {
    mockFetch({
        rest_online: true,
        indexing_latency: 8
    });

    const { data, error } = await status();
    expect(error).toBeNull();
    expect(data).toBeDefined();
});

test('Client apiKey test', async () => {
    const fetchSpy = mockFetch({
        rest_online: true,
        indexing_latency: 8
    });

    useTaWithApiKey();
    const { data, error } = await status();
    expect(error).toBeNull();
    expect(data).toBeDefined();

    expect(fetchSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
            headers: expect.objectContaining({
                Authorization: 'Bearer TEST_API_KEY'
            })
        })
    );
});

test('Client apiKey missing test', async () => {
    const fetchSpy = mockFetch({
        rest_online: true,
        indexing_latency: 8
    });

    initClient({
        baseUrl: 'https://tonapi.io'
    });
    const { data, error } = await status();
    expect(error).toBeNull();
    expect(data).toBeDefined();

    expect(fetchSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
            headers: expect.not.objectContaining({
                Authorization: expect.anything()
            })
        })
    );
});

test('Client fallback test', async () => {
    const fetchSpy = mockFetch({
        rest_online: true,
        indexing_latency: 8
    });

    initClient({
        baseUrl: 'https://tonapi.io'
    });
    const { data, error } = await status();
    expect(error).toBeNull();
    expect(data).toBeDefined();

    expect(fetchSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
            headers: expect.not.objectContaining({
                Authorization: expect.anything()
            })
        })
    );
});

test('Client x-tonapi-client header test', async () => {
    const fetchSpy = mockFetch({
        rest_online: true,
        indexing_latency: 8
    });

    const { data, error } = await status();
    expect(error).toBeNull();
    expect(data).toBeDefined();

    expect(fetchSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
            headers: expect.objectContaining({
                'x-tonapi-client': expect.stringMatching(/^tonapi-js@/)
            })
        })
    );
});

test('Client custom fetch is called', async () => {
    const mockResponse = {
        rest_online: true,
        indexing_latency: 8
    };

    const customFetch = vi.fn().mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        })
    );

    initClient({
        baseUrl: 'https://tonapi.io',
        fetch: customFetch
    });

    await status();

    expect(customFetch).toHaveBeenCalled();
});

test('Client post method in fetch', async () => {
    const fetchSpy = mockFetch(getAccounts);

    const accountIds = [
        'UQCae11h9N5znylEPRjmuLYGvIwnxkcCw4zVW4BJjVASi5eL',
        'UQAW2nxA69WYdMr90utDmpeZFwvG4XYcc9iibAP5sZnlojRO'
    ];

    const { data, error } = await getAccountsOp({
        accountIds: accountIds.map(id => Address.parse(id))
    });

    expect(error).toBeNull();
    expect(data).toBeDefined();

    expect(fetchSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
            method: 'POST'
        })
    );
});

test('Client response type for schema outside component (with snake_case)', async () => {
    mockFetch({
        public_key: '9544d2cccdd17e06e27f14fd531f803378d27f64710fd6aadc418c53d0660ec6'
    });

    const senderAddress = Address.parse('UQAQxxpzxmEVU0Lu8U0zNTxBzXIWPvo263TIN1OQM9YvxsnV');
    const { data, error } = await getAccountPublicKey(senderAddress);

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data?.publicKey).toBe('9544d2cccdd17e06e27f14fd531f803378d27f64710fd6aadc418c53d0660ec6');
});

describe('Client initialization and configuration', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    test('initClient() should initialize the singleton client', async () => {
    const fetchSpy = mockFetch({
        rest_online: true,
        indexing_latency: 8
    });

    initClient({
        baseUrl: 'https://tonapi.io',
        apiKey: 'test-key-123'
    });

    await status();

    expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('https://tonapi.io'),
        expect.objectContaining({
            headers: expect.objectContaining({
                Authorization: 'Bearer test-key-123'
            })
        })
    );
});

test('initClient() should reinitialize the singleton client', async () => {
    const fetchSpy = mockFetch({
        rest_online: true,
        indexing_latency: 8
    });

    // First initialization
    initClient({
        baseUrl: 'https://tonapi.io',
        apiKey: 'first-key'
    });

    // Second initialization should replace the client
    initClient({
        baseUrl: 'https://tonapi.io',
        apiKey: 'second-key'
    });

    await status();

    expect(fetchSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
            headers: expect.objectContaining({
                Authorization: 'Bearer second-key'
            })
        })
    );
});

test('reinitializing client should update apiKey', async () => {
    const fetchSpy = mockFetch({
        rest_online: true,
        indexing_latency: 8
    });

    initClient({
        baseUrl: 'https://tonapi.io',
        apiKey: 'initial-key'
    });

    // Reinitialize with new apiKey
    initClient({
        baseUrl: 'https://tonapi.io',
        apiKey: 'updated-key'
    });

    await status();

    expect(fetchSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
            headers: expect.objectContaining({
                Authorization: 'Bearer updated-key'
            })
        })
    );
});

test('reinitializing client should update baseUrl', async () => {
    const fetchSpy = mockFetch({
        rest_online: true,
        indexing_latency: 8
    });

    initClient({
        baseUrl: 'https://tonapi.io'
    });

    // Reinitialize with new baseUrl
    initClient({
        baseUrl: 'https://testnet.tonapi.io'
    });

    await status();

    expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('https://testnet.tonapi.io'),
        expect.anything()
    );
});

test('reinitializing client should update custom fetch', async () => {
    const mockResponse = {
        rest_online: true,
        indexing_latency: 8
    };

    const firstFetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(mockResponse), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        })
    );

    const secondFetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(mockResponse), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        })
    );

    initClient({
        baseUrl: 'https://tonapi.io',
        fetch: firstFetch
    });

    // Reinitialize with secondFetch
    initClient({
        baseUrl: 'https://tonapi.io',
        fetch: secondFetch
    });

    await status();

    expect(firstFetch).not.toHaveBeenCalled();
    expect(secondFetch).toHaveBeenCalled();
});

test('operations should share the same singleton client', async () => {
    initClient({
        baseUrl: 'https://tonapi.io',
        apiKey: 'shared-key'
    });

    // First operation
    const statusSpy = mockFetch({
        rest_online: true,
        indexing_latency: 8
    });

    await status();

    expect(statusSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
            headers: expect.objectContaining({
                Authorization: 'Bearer shared-key'
            })
        })
    );

    // Second operation should use the same client with same apiKey
    const accountSpy = mockFetch({ balance: '1000000000' });

    const address = Address.parse('EQAvDfWFG0oYX19jwNDNBBL1rKNT9XfaGP9HyTb5nb2Eml6y');
    await getAccount(address);

    expect(accountSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
            headers: expect.objectContaining({
                Authorization: 'Bearer shared-key'
            })
        })
    );
});

test('lazy initialization: operations should work without explicit initClient()', async () => {
    const fetchSpy = mockFetch({
        rest_online: true,
        indexing_latency: 8
    });

    // Don't call initClient(), just use the operation directly
    // This should create a default client
    const { data, error } = await status();

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(fetchSpy).toHaveBeenCalled();
});

test('reinitializing without apiKey should remove Authorization header', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ rest_online: true, indexing_latency: 8 }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        })
    );

    vi.spyOn(global, 'fetch').mockImplementation(fetchSpy);

    // First, init with apiKey
    initClient({
        baseUrl: 'https://tonapi.io',
        apiKey: 'will-be-removed'
    });

    await status();

    let callArgs = fetchSpy.mock.calls[0];
    let headers = callArgs?.[1]?.headers as Record<string, string>;
    expect(headers?.Authorization).toBe('Bearer will-be-removed');

    fetchSpy.mockClear();

    // Reinitialize without apiKey
    initClient({
        baseUrl: 'https://tonapi.io'
    });

    await status();

    callArgs = fetchSpy.mock.calls[0];
    headers = callArgs?.[1]?.headers as Record<string, string>;

    // Check that Authorization header is not present after reinitialization
    expect(headers).toBeDefined();
    expect(headers?.Authorization).toBeUndefined();
    expect(headers?.['x-tonapi-client']).toBeDefined(); // Should still have other headers
});

test('configuration changes should persist across multiple requests', async () => {
    initClient({
        baseUrl: 'https://tonapi.io',
        apiKey: 'persistent-key'
    });

    // Make first request
    const firstSpy = mockFetch({
        rest_online: true,
        indexing_latency: 8
    });

    await status();

    expect(firstSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
            headers: expect.objectContaining({
                Authorization: 'Bearer persistent-key'
            })
        })
    );

    // Make second request - should still use the same configuration
    const secondSpy = mockFetch({ rest_online: true, indexing_latency: 8 });

    await status();

    expect(secondSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
            headers: expect.objectContaining({
                Authorization: 'Bearer persistent-key'
            })
        })
    );
});

test('initClient() with baseApiParams should set custom headers', async () => {
    const fetchSpy = mockFetch({
        rest_online: true,
        indexing_latency: 8
    });

    initClient({
        baseUrl: 'https://tonapi.io',
        baseApiParams: {
            headers: {
                'Custom-Header': 'custom-value',
                'Another-Header': 'another-value'
            }
        }
    });

    await status();

    expect(fetchSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
            headers: expect.objectContaining({
                'Custom-Header': 'custom-value',
                'Another-Header': 'another-value'
            })
        })
    );
});

    test('initClient() should work with minimal configuration', async () => {
        const fetchSpy = mockFetch({
            rest_online: true,
            indexing_latency: 8
        });

        initClient();
        const { data, error } = await status();

        expect(error).toBeNull();
        expect(data).toBeDefined();
        expect(fetchSpy).toHaveBeenCalled();
    });
});
