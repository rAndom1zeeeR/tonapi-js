import { Address } from '@ton/core';
import { getBlockchainRawAccount as getBlockchainRawAccountOp, getAccounts as getAccountsOp } from '@ton-api/client';
import { initTa } from './utils/client';
import { getAccounts, getBlockchainRawAccount } from './__mock__/address';
import { vi, test, expect, afterEach, beforeEach } from 'vitest';
import { mockFetch } from './utils/mockFetch';

beforeEach(() => {
    initTa();
});

afterEach(() => {
    vi.restoreAllMocks();
});

test('Address simple in params & response', async () => {
    const fetchSpy = mockFetch(getBlockchainRawAccount);

    const addressString = 'UQC62nZpm36EFzADVfXDVd_4OpbFyc1D3w3ZvCPHLni8Dst4';
    const addressObject = Address.parse(addressString);
    const addressRawString = addressObject.toRawString();
    const { data, error } = await getBlockchainRawAccountOp(addressObject);

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(Address.isAddress(data?.address)).toBe(true);
    expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining(addressRawString),
        expect.any(Object)
    );
});

test('Address in request body test', async () => {
    const fetchSpy = mockFetch(getAccounts);

    const addressStrings = [
        '0:009d03ddede8c2620a72f999d03d5888102250a214bf574a29ff64df80162168',
        '0:7c9fc62291740a143086c807fe322accfd12737b3c2243676228176707c7ce40'
    ];

    const accountIds = addressStrings.map(str => Address.parse(str));
    const { data, error } = await getAccountsOp({ accountIds });

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(fetchSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
            body: JSON.stringify({
                account_ids: addressStrings.map(addr => Address.parse(addr).toRawString())
            })
        })
    );
});
