import { status, getAccount, execGetMethodForBlockchainAccount, TonApiParsingError } from '@ton-api/client';
import { Address } from '@ton/core';
import { initTa } from './utils/client';
import { vi, test, expect, beforeEach, describe } from 'vitest';
import { mockFetch } from './utils/mockFetch';

beforeEach(() => {
    initTa();
    vi.restoreAllMocks();
});

const createJsonResponse = (data: any, status = 200) => {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' }
    });
};

test('should return a successful response with JSON data', async () => {
    const mockData = { status: 'ok', uptime: 123456 };
    const fetchSpy = mockFetch(mockData);

    const { data, error } = await status();
    expect(error).toBeNull();
    expect(data).toEqual(mockData);
    expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/v2/status'),
        expect.any(Object)
    );
});

test('should handle an error response with a JSON message', async () => {
    const mockError = { error: 'Invalid request' };
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(createJsonResponse(mockError, 400));

    const { data, error } = await status();
    expect(data).toBeNull();
    expect(error).not.toBeNull();
    expect(error?.message).toBe('Invalid request');
    expect(error?.status).toBe(400);
    expect(error?.type).toBe('http_error');
});

test('should handle an error response with a string message', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(createJsonResponse('Simple error message', 500));

    const { data, error } = await status();
    expect(data).toBeNull();
    expect(error).not.toBeNull();
    expect(error?.message).toBe('Simple error message');
    expect(error?.status).toBe(500);
    expect(error?.type).toBe('http_error');
});

test('should include cause in the error object', async () => {
    const mockError = { error: 'Invalid request' };
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(createJsonResponse(mockError, 400));

    const { data, error } = await status();
    expect(data).toBeNull();
    expect(error).not.toBeNull();
    expect(error?.message).toBe('Invalid request');
    expect(error?.cause).toBeDefined();
    expect(error?.type).toBe('http_error');
});

test('should handle an error response without JSON', async () => {
    const mockError = new Error('Network failure');
    vi.spyOn(global, 'fetch').mockRejectedValueOnce(mockError);

    const { data, error } = await status();
    expect(data).toBeNull();
    expect(error).not.toBeNull();
    expect(error?.message).toBe('Network failure');
    expect(error?.type).toBe('network_error');
});

test('should handle an error response with invalid JSON', async () => {
    const response = new Response('Invalid JSON', {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
    });
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(response);

    const { data, error } = await status();
    expect(data).toBeNull();
    expect(error).not.toBeNull();
    expect(error?.message).toContain('Failed to parse error response');
    expect(error?.status).toBe(400);
    expect(error?.type).toBe('http_error');
});

test('should handle an unknown error type (object)', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValueOnce({ message: 'Some unknown error' } as any);

    const { data, error } = await status();
    expect(data).toBeNull();
    expect(error).not.toBeNull();
    expect(error?.message).toBe('Unknown error occurred');
});

test('should handle an unknown error type (string)', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValueOnce('Some unknown error' as any);

    const { data, error } = await status();
    expect(data).toBeNull();
    expect(error).not.toBeNull();
    expect(error?.message).toBe('Unknown error occurred');
});

test('should handle null as an error', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValueOnce(null as any);

    const { data, error } = await status();
    expect(data).toBeNull();
    expect(error).not.toBeNull();
    expect(error?.message).toBe('Unknown error occurred');
});

test('should handle undefined as an error', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValueOnce(undefined as any);

    const { data, error } = await status();
    expect(data).toBeNull();
    expect(error).not.toBeNull();
    expect(error?.message).toBe('Unknown error occurred');
});

test('should handle a JSON error response without an error field', async () => {
    const mockError = { message: 'Some error without error field' };
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(createJsonResponse(mockError, 400));

    const { data, error } = await status();
    expect(data).toBeNull();
    expect(error).not.toBeNull();
    expect(error?.message).toBe('Some error without error field');
    expect(error?.status).toBe(400);
    expect(error?.type).toBe('http_error');
});

describe('Parsing validation errors', () => {
    describe('Invalid Address parsing', () => {
        test('should return parsing_error for invalid address string', async () => {
            // Mock API response with invalid address
            mockFetch({
                address: 'invalid-address-string',
                balance: '1000000000',
                status: 'active'
            });

            const validAddress = Address.parse('EQAvDfWFG0oYX19jwNDNBBL1rKNT9XfaGP9HyTb5nb2Eml6y');
            const { data, error } = await getAccount(validAddress);

            expect(data).toBeNull();
            expect(error).toBeDefined();
            expect(error?.type).toBe('parsing_error');
            expect(error?.message).toContain('SDK parsing error [Address]');
            expect(error?.cause).toBeDefined();
            expect(error?.cause).toBeInstanceOf(TonApiParsingError);
            if (error?.cause instanceof TonApiParsingError) {
                expect(error.cause.parsingType).toBe('Address');
            }
        });

        test('should return parsing_error for empty address string', async () => {
            mockFetch({
                address: '',
                balance: '1000000000',
                status: 'active'
            });

            const validAddress = Address.parse('EQAvDfWFG0oYX19jwNDNBBL1rKNT9XfaGP9HyTb5nb2Eml6y');
            const { data, error } = await getAccount(validAddress);

            expect(data).toBeNull();
            expect(error).toBeDefined();
            expect(error?.type).toBe('parsing_error');
            expect(error?.message).toContain('SDK parsing error [Address]');
            expect(error?.cause).toBeInstanceOf(TonApiParsingError);
            if (error?.cause instanceof TonApiParsingError) {
                expect(error.cause.parsingType).toBe('Address');
            }
        });

        test('should return parsing_error for malformed address format', async () => {
            mockFetch({
                address: 'EQ_this_is_not_valid_base64',
                balance: '1000000000',
                status: 'active'
            });

            const validAddress = Address.parse('EQAvDfWFG0oYX19jwNDNBBL1rKNT9XfaGP9HyTb5nb2Eml6y');
            const { data, error } = await getAccount(validAddress);

            expect(data).toBeNull();
            expect(error?.type).toBe('parsing_error');
            expect(error?.message).toContain('SDK parsing error [Address]');
            expect(error?.cause).toBeInstanceOf(TonApiParsingError);
            if (error?.cause instanceof TonApiParsingError) {
                expect(error.cause.parsingType).toBe('Address');
            }
        });
    });

    describe('Invalid Cell parsing', () => {
        test('should return parsing_error for invalid cell hex string', async () => {
            mockFetch({
                success: true,
                exit_code: 0,
                stack: [
                    {
                        type: 'cell',
                        cell: 'invalid-hex-string'
                    }
                ]
            });

            const address = Address.parse('EQAvDfWFG0oYX19jwNDNBBL1rKNT9XfaGP9HyTb5nb2Eml6y');
            const { data, error } = await execGetMethodForBlockchainAccount(address, 'get_data');

            expect(data).toBeNull();
            expect(error).toBeDefined();
            expect(error?.type).toBe('parsing_error');
            expect(error?.message).toContain('SDK parsing error [Cell]');
            expect(error?.cause).toBeDefined();
            expect(error?.cause).toBeInstanceOf(TonApiParsingError);
            if (error?.cause instanceof TonApiParsingError) {
                expect(error.cause.parsingType).toBe('Cell');
            }
        });

        test('should return parsing_error for invalid cell BoC format', async () => {
            mockFetch({
                success: true,
                exit_code: 0,
                stack: [
                    {
                        type: 'cell',
                        cell: 'b5ee9c72410101010007' // Valid hex but invalid BoC format
                    }
                ]
            });

            const address = Address.parse('EQAvDfWFG0oYX19jwNDNBBL1rKNT9XfaGP9HyTb5nb2Eml6y');
            const { data, error } = await execGetMethodForBlockchainAccount(address, 'get_data');

            expect(data).toBeNull();
            expect(error?.type).toBe('parsing_error');
            expect(error?.message).toContain('SDK parsing error [Cell]');
            expect(error?.cause).toBeInstanceOf(TonApiParsingError);
            if (error?.cause instanceof TonApiParsingError) {
                expect(error.cause.parsingType).toBe('Cell');
            }
        });

        test('should return parsing_error for odd length hex string', async () => {
            mockFetch({
                success: true,
                exit_code: 0,
                stack: [
                    {
                        type: 'cell',
                        cell: 'abc' // 3 characters - odd length
                    }
                ]
            });

            const address = Address.parse('EQAvDfWFG0oYX19jwNDNBBL1rKNT9XfaGP9HyTb5nb2Eml6y');
            const { data, error } = await execGetMethodForBlockchainAccount(address, 'get_data');

            expect(data).toBeNull();
            expect(error?.type).toBe('parsing_error');
            expect(error?.message).toContain('SDK parsing error [Cell]');
            expect(error?.cause).toBeInstanceOf(TonApiParsingError);
            if (error?.cause instanceof TonApiParsingError) {
                expect(error.cause.parsingType).toBe('Cell');
            }
        });

        test('should return parsing_error for non-hex characters in cell', async () => {
            mockFetch({
                success: true,
                exit_code: 0,
                stack: [
                    {
                        type: 'cell',
                        cell: 'zzxxyyaabbcc'
                    }
                ]
            });

            const address = Address.parse('EQAvDfWFG0oYX19jwNDNBBL1rKNT9XfaGP9HyTb5nb2Eml6y');
            const { data, error } = await execGetMethodForBlockchainAccount(address, 'get_data');

            expect(data).toBeNull();
            expect(error?.type).toBe('parsing_error');
            expect(error?.message).toContain('SDK parsing error [Cell]');
            expect(error?.cause).toBeInstanceOf(TonApiParsingError);
            if (error?.cause instanceof TonApiParsingError) {
                expect(error.cause.parsingType).toBe('Cell');
            }
        });
    });

    describe('Invalid BigInt parsing', () => {
        test('should return parsing_error for non-numeric BigInt string', async () => {
            mockFetch({
                address: 'EQAvDfWFG0oYX19jwNDNBBL1rKNT9XfaGP9HyTb5nb2Eml6y',
                balance: 'not-a-number',
                status: 'active'
            });

            const validAddress = Address.parse('EQAvDfWFG0oYX19jwNDNBBL1rKNT9XfaGP9HyTb5nb2Eml6y');
            const { data, error } = await getAccount(validAddress);

            expect(data).toBeNull();
            expect(error).toBeDefined();
            expect(error?.type).toBe('parsing_error');
            expect(error?.message).toContain('SDK parsing error [BigInt]');
            expect(error?.cause).toBeDefined();
            expect(error?.cause).toBeInstanceOf(TonApiParsingError);
            if (error?.cause instanceof TonApiParsingError) {
                expect(error.cause.parsingType).toBe('BigInt');
            }
        });

        test('should return parsing_error for invalid BigInt format', async () => {
            mockFetch({
                address: 'EQAvDfWFG0oYX19jwNDNBBL1rKNT9XfaGP9HyTb5nb2Eml6y',
                balance: '123.456', // Decimal number, BigInt doesn't support decimals
                status: 'active'
            });

            const validAddress = Address.parse('EQAvDfWFG0oYX19jwNDNBBL1rKNT9XfaGP9HyTb5nb2Eml6y');
            const { data, error } = await getAccount(validAddress);

            expect(data).toBeNull();
            expect(error?.type).toBe('parsing_error');
            expect(error?.message).toContain('SDK parsing error [BigInt]');
            expect(error?.cause).toBeInstanceOf(TonApiParsingError);
            if (error?.cause instanceof TonApiParsingError) {
                expect(error.cause.parsingType).toBe('BigInt');
            }
        });

        test('should handle empty string in BigInt field (converts to 0n)', async () => {
            // Note: BigInt('') actually returns 0n, not an error
            mockFetch({
                address: 'EQAvDfWFG0oYX19jwNDNBBL1rKNT9XfaGP9HyTb5nb2Eml6y',
                balance: '',
                status: 'active'
            });

            const validAddress = Address.parse('EQAvDfWFG0oYX19jwNDNBBL1rKNT9XfaGP9HyTb5nb2Eml6y');
            const { data, error } = await getAccount(validAddress);

            // Empty string converts to 0n without error
            expect(error).toBeNull();
            expect(data).toBeDefined();
            expect(data?.balance).toBe(0n);
        });
    });

    describe('Invalid TupleItem type', () => {
        test('should return parsing_error for unknown tuple item type', async () => {
            mockFetch({
                success: true,
                exit_code: 0,
                stack: [
                    {
                        type: 'unknown_type',
                        value: 'some-value'
                    }
                ]
            });

            const address = Address.parse('EQAvDfWFG0oYX19jwNDNBBL1rKNT9XfaGP9HyTb5nb2Eml6y');
            const { data, error } = await execGetMethodForBlockchainAccount(address, 'get_data');

            expect(data).toBeNull();
            expect(error).toBeDefined();
            expect(error?.type).toBe('parsing_error');
            expect(error?.message).toContain('SDK parsing error [TupleItem]');
            expect(error?.message).toContain('Unknown tuple item type');
            expect(error?.cause).toBeDefined();
            expect(error?.cause).toBeInstanceOf(TonApiParsingError);
            if (error?.cause instanceof TonApiParsingError) {
                expect(error.cause.parsingType).toBe('TupleItem');
            }
        });

        test('should return parsing_error for invalid type in nested tuple', async () => {
            mockFetch({
                success: true,
                exit_code: 0,
                stack: [
                    {
                        type: 'tuple',
                        tuple: [
                            {
                                type: 'invalid_nested_type',
                                value: 'test'
                            }
                        ]
                    }
                ]
            });

            const address = Address.parse('EQAvDfWFG0oYX19jwNDNBBL1rKNT9XfaGP9HyTb5nb2Eml6y');
            const { data, error } = await execGetMethodForBlockchainAccount(address, 'get_data');

            expect(data).toBeNull();
            expect(error?.type).toBe('parsing_error');
            expect(error?.message).toContain('SDK parsing error [TupleItem]');
            expect(error?.message).toContain('Unknown tuple item type');
            expect(error?.cause).toBeInstanceOf(TonApiParsingError);
            if (error?.cause instanceof TonApiParsingError) {
                expect(error.cause.parsingType).toBe('TupleItem');
            }
        });
    });

    describe('Error structure validation', () => {
        test('parsing_error should have correct structure', async () => {
            mockFetch({
                address: 'invalid',
                balance: '1000000000',
                status: 'active'
            });

            const validAddress = Address.parse('EQAvDfWFG0oYX19jwNDNBBL1rKNT9XfaGP9HyTb5nb2Eml6y');
            const { data, error } = await getAccount(validAddress);

            expect(data).toBeNull();
            expect(error).toBeDefined();

            // Verify error structure
            expect(error).toHaveProperty('message');
            expect(error).toHaveProperty('type');
            expect(error).toHaveProperty('cause');

            expect(typeof error?.message).toBe('string');
            expect(error?.type).toBe('parsing_error');
            expect(error?.message).toContain('SDK parsing error [Address]');
        });

        test('cause should contain the original error', async () => {
            mockFetch({
                address: 'invalid-address',
                balance: '1000000000',
                status: 'active'
            });

            const validAddress = Address.parse('EQAvDfWFG0oYX19jwNDNBBL1rKNT9XfaGP9HyTb5nb2Eml6y');
            const { data, error } = await getAccount(validAddress);

            expect(error?.cause).toBeDefined();
            expect(error?.cause).toBeInstanceOf(TonApiParsingError);
            if (error?.cause instanceof TonApiParsingError) {
                expect(error.cause.parsingType).toBe('Address');
            }
        });
    });
});
