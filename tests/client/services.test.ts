import { Address } from '@ton/core';
import { getChartRates, getRates as getRatesOp } from '@ton-api/client';
import { initTa } from './utils/client';
import { getChartRates as getChartRatesMock, getRates as getRatesMock } from './__mock__/services';
import { mockFetch } from './utils/mockFetch';
import { test, expect, afterEach, beforeEach, vi } from 'vitest';

beforeEach(() => {
    initTa();
});

afterEach(() => {
    vi.restoreAllMocks();
});

test('getChartRates, should correct parse array in pair', async () => {
    mockFetch(getChartRatesMock);

    const addressString = 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs';
    const addressObject = Address.parse(addressString);
    const { data, error } = await getChartRates({
        token: addressObject,
        currency: 'rub'
    });

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data?.points).toBeDefined();
    expect(Array.isArray(data?.points)).toBe(true);
    expect(data?.points?.length).toBeGreaterThan(0);

    data?.points?.forEach(point => {
        expect(Array.isArray(point)).toBe(true);
        expect(point.length).toBe(2);

        const [timestamp, value] = point;

        expect(typeof timestamp).toBe('number');
        expect(timestamp).toBeGreaterThan(0);

        expect(typeof value).toBe('number');
    });
});

test('getRates, additionalProperties should be not convert to camelCase', async () => {
    mockFetch(getRatesMock);

    const { data, error } = await getRatesOp({
        tokens: ['TON,TOKEN_WITH_UNDERSCORE'],
        currencies: ['USD', 'EUR']
    });

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data?.rates).toBeDefined();
    expect(data?.rates['TON']).toBeDefined();
    expect(data?.rates['TOKEN_WITH_UNDERSCORE']).toBeDefined();
});

test('getRates, explode in params should be matter', async () => {
    const fetchSpy = mockFetch(getRatesMock);
    // const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce(
    //     new Response(JSON.stringify(getRates), {
    //         status: 200,
    //         headers: { 'Content-Type': 'application/json' }
    //     })
    // );

    await getRatesOp({
        tokens: ['TON', 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs'],
        currencies: ['USD', 'EUR']
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const url = fetchSpy.mock.calls[0]?.[0] as string;
    const searchParams = new URL(url).searchParams;

    expect(searchParams.get('tokens')).toBe('TON,EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs');
    expect(searchParams.get('currencies')).toBe('USD,EUR');
});

test('getChartRates, should serialize Address object to string', async () => {
    const fetchSpy = mockFetch(getChartRatesMock);

    const addressString = 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs';
    const addressObject = Address.parse(addressString);

    await getChartRates({
        token: addressObject,
        currency: 'usd'
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const url = fetchSpy.mock.calls[0]?.[0] as string;
    const searchParams = new URL(url).searchParams;

    // Address object should be serialized to its string representation
    expect(searchParams.get('token')).toBe(addressString);
    expect(searchParams.get('currency')).toBe('usd');
});

test('getChartRates, should accept string token directly', async () => {
    const fetchSpy = mockFetch(getChartRatesMock);

    const addressString = 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs';

    await getChartRates({
        token: addressString,
        currency: 'usd'
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const url = fetchSpy.mock.calls[0]?.[0] as string;
    const searchParams = new URL(url).searchParams;

    expect(searchParams.get('token')).toBe(addressString);
    expect(searchParams.get('currency')).toBe('usd');
});
