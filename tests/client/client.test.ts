import { initClient, status, getAccounts as getAccountsOp, getAccountPublicKey } from '@ton-api/client';
import { initTa, useTa, useTaWithApiKey } from './utils/client';
import { Address } from '@ton/core';
import { getAccounts } from './__mock__/services';
import { vi, test, expect, afterEach, beforeEach } from 'vitest';
import { mockFetch } from './utils/mockFetch';

beforeEach(() => {
    // Reset to default client before each test
    initTa();
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
