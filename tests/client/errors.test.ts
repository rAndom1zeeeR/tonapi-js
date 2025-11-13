import { initTa, ta } from './utils/client';
import { status, getAccount, execGetMethodForBlockchainAccount, TonApiParsingError, TonApiHttpError, TonApiNetworkError, TonApiUnknownError } from '@ton-api/client';
import { Address } from '@ton/core';
import { vi, test, expect, beforeEach, describe, afterEach } from 'vitest';
import { mockFetch } from './utils/mockFetch';

beforeEach(() => {
    vi.restoreAllMocks();
    // Suppress console.error logs from parsing errors
    vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
    vi.restoreAllMocks();
});

const createJsonResponse = (data: any, statusCode = 200) => {
    return new Response(JSON.stringify(data), {
        status: statusCode,
        headers: { 'Content-Type': 'application/json' }
    });
};

// Helper to catch thrown errors for clean assertion
async function expectThrowingError(fn: () => Promise<any>) {
    return await fn().catch(err => err);
}

// Type assertion helpers for safe error testing
function assertIsHttpError(error: unknown): asserts error is TonApiHttpError {
    expect(error).toBeInstanceOf(TonApiHttpError);
}

function assertIsNetworkError(error: unknown): asserts error is TonApiNetworkError {
    expect(error).toBeInstanceOf(TonApiNetworkError);
}

function assertIsParsingError(error: unknown): asserts error is TonApiParsingError {
    expect(error).toBeInstanceOf(TonApiParsingError);
}

function assertIsUnknownError(error: unknown): asserts error is TonApiUnknownError {
    expect(error).toBeInstanceOf(TonApiUnknownError);
}

// ============================================================================
// PRIMARY APPROACH: Instance-based methods with throw on error (ta.*)
// ============================================================================

describe('Instance API - Primary approach (throws errors)', () => {
    test('should return a successful response with JSON data', async () => {
        const mockData = { rest_online: true, indexing_latency: 8 };
        const fetchSpy = mockFetch(mockData);

        const result = await ta.status();
        expect(result).toBeDefined();
        // Response is converted to camelCase
        expect(result?.restOnline).toBe(true);
        expect(result?.indexingLatency).toBe(8);
        expect(fetchSpy).toHaveBeenCalledWith(
            expect.stringContaining('/v2/status'),
            expect.any(Object)
        );
    });

    // ========================================================================
    // TonApiHttpError
    // ========================================================================

    describe('TonApiHttpError', () => {
        test('should have all required properties', async () => {
            const mockError = { error: 'Test error', code: 'TEST_CODE' };
            vi.spyOn(global, 'fetch').mockResolvedValueOnce(createJsonResponse(mockError, 400));

            const error = await expectThrowingError(() => ta.status());
            assertIsHttpError(error);

            // Verify all required properties
            expect(error).toHaveProperty('message');
            expect(error).toHaveProperty('status');
            expect(error).toHaveProperty('type');
            expect(error).toHaveProperty('url');
            expect(error).toHaveProperty('code');
            expect(error).toHaveProperty('originalCause');

            expect(typeof error.message).toBe('string');
            expect(typeof error.status).toBe('number');
            expect(error.type).toBe('http_error');
            expect(typeof error.url).toBe('string');
            expect(error.status).toBe(400);
        });

        test('should throw with JSON message', async () => {
            const mockError = { error: 'Invalid request' };
            vi.spyOn(global, 'fetch').mockResolvedValueOnce(createJsonResponse(mockError, 400));

            const error = await expectThrowingError(() => ta.status());
            assertIsHttpError(error);
            expect(error.message).toContain('Invalid request');
            expect(error.status).toBe(400);
            expect(error.type).toBe('http_error');
        });

        test('should throw with string message', async () => {
            vi.spyOn(global, 'fetch').mockResolvedValueOnce(createJsonResponse('Simple error message', 500));

            const error = await expectThrowingError(() => ta.status());
            assertIsHttpError(error);
            expect(error.message).toContain('Simple error message');
            expect(error.status).toBe(500);
            expect(error.type).toBe('http_error');
        });

        test('should throw with proper structure', async () => {
            const mockError = { error: 'Invalid request' };
            vi.spyOn(global, 'fetch').mockResolvedValueOnce(createJsonResponse(mockError, 400));

            const error = await expectThrowingError(() => ta.status());
            expect(error).toBeDefined();
            expect(error.message).toBeDefined();
            assertIsHttpError(error);
        });

        test('should throw without error field', async () => {
            const mockError = { message: 'Some error without error field' };
            vi.spyOn(global, 'fetch').mockResolvedValueOnce(createJsonResponse(mockError, 400));

            const error = await expectThrowingError(() => ta.status());
            assertIsHttpError(error);
            expect(error.message).toContain('Some error without error field');
            expect(error.status).toBe(400);
            expect(error.type).toBe('http_error');
        });

        test('should throw when response has invalid JSON', async () => {
            const response = new Response('Invalid JSON', {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
            vi.spyOn(global, 'fetch').mockResolvedValueOnce(response);

            const error = await expectThrowingError(() => ta.status());
            assertIsHttpError(error);
            expect(error.type).toBe('http_error');
        });
    });

    // ========================================================================
    // TonApiNetworkError
    // ========================================================================

    describe('TonApiNetworkError', () => {
        test('should have all required properties', async () => {
            const mockError = new Error('Network failure');
            vi.spyOn(global, 'fetch').mockRejectedValueOnce(mockError);

            const error = await expectThrowingError(() => ta.status());
            assertIsNetworkError(error);

            // Verify all required properties
            expect(error).toHaveProperty('message');
            expect(error).toHaveProperty('type');
            expect(error).toHaveProperty('originalCause');

            expect(typeof error.message).toBe('string');
            expect(error.type).toBe('network_error');
            expect(error.originalCause).toBeInstanceOf(Error);
        });

        test('should throw when network fails', async () => {
            const mockError = new Error('Network failure');
            vi.spyOn(global, 'fetch').mockRejectedValueOnce(mockError);

            const error = await expectThrowingError(() => ta.status());
            assertIsNetworkError(error);
            expect(error.message).toContain('Network failure');
            expect(error.type).toBe('network_error');
        });
    });

    // ========================================================================
    // TonApiUnknownError
    // ========================================================================

    describe('TonApiUnknownError', () => {
        test('should have all required properties', async () => {
            vi.spyOn(global, 'fetch').mockRejectedValueOnce({ message: 'Some unknown error' });

            const error = await expectThrowingError(() => ta.status());
            assertIsUnknownError(error);

            // Verify all required properties
            expect(error).toHaveProperty('message');
            expect(error).toHaveProperty('type');
            expect(error).toHaveProperty('originalCause');

            expect(typeof error.message).toBe('string');
            expect(error.type).toBe('unknown_error');
            expect(error.originalCause).toBeDefined();
        });

        test('should throw on unknown error type (object)', async () => {
            vi.spyOn(global, 'fetch').mockRejectedValueOnce({ message: 'Some unknown error' });

            const error = await expectThrowingError(() => ta.status());
            assertIsUnknownError(error);
            expect(error.type).toBe('unknown_error');
        });

        test('should throw on unknown error type (string)', async () => {
            vi.spyOn(global, 'fetch').mockRejectedValueOnce('Some unknown error');

            const error = await expectThrowingError(() => ta.status());
            assertIsUnknownError(error);
            expect(error.type).toBe('unknown_error');
        });

        test('should throw when error is null', async () => {
            vi.spyOn(global, 'fetch').mockRejectedValueOnce(null);

            const error = await expectThrowingError(() => ta.status());
            assertIsUnknownError(error);
            expect(error.type).toBe('unknown_error');
        });

        test('should throw when error is undefined', async () => {
            vi.spyOn(global, 'fetch').mockRejectedValueOnce(undefined);

            const error = await expectThrowingError(() => ta.status());
            assertIsUnknownError(error);
            expect(error.type).toBe('unknown_error');
        });
    });

    // ========================================================================
    // TonApiParsingError
    // ========================================================================

    describe('TonApiParsingError', () => {
        describe('Invalid Address parsing', () => {
            test('should throw parsing_error for invalid address string', async () => {
                mockFetch({
                    address: 'invalid-address-string',
                    balance: '1000000000',
                    status: 'active'
                });

                const validAddress = Address.parse('EQAvDfWFG0oYX19jwNDNBBL1rKNT9XfaGP9HyTb5nb2Eml6y');
                const error = await expectThrowingError(() => ta.getAccount(validAddress));

                assertIsParsingError(error);
                expect(error.parsingType).toBe('Address');
                expect(error.type).toBe('parsing_error');
            });

            test('should throw parsing_error for empty address string', async () => {
                mockFetch({
                    address: '',
                    balance: '1000000000',
                    status: 'active'
                });

                const validAddress = Address.parse('EQAvDfWFG0oYX19jwNDNBBL1rKNT9XfaGP9HyTb5nb2Eml6y');
                const error = await expectThrowingError(() => ta.getAccount(validAddress));

                assertIsParsingError(error);
                expect(error.parsingType).toBe('Address');
            });

            test('should throw parsing_error for malformed address format', async () => {
                mockFetch({
                    address: 'EQ_this_is_not_valid_base64',
                    balance: '1000000000',
                    status: 'active'
                });

                const validAddress = Address.parse('EQAvDfWFG0oYX19jwNDNBBL1rKNT9XfaGP9HyTb5nb2Eml6y');
                const error = await expectThrowingError(() => ta.getAccount(validAddress));

                assertIsParsingError(error);
                expect(error.parsingType).toBe('Address');
            });
        });

        describe('Invalid Cell parsing', () => {
            test('should throw parsing_error for invalid cell hex string', async () => {
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
                const error = await expectThrowingError(() => ta.execGetMethodForBlockchainAccount(address, 'get_data'));

                assertIsParsingError(error);
                expect(error.parsingType).toBe('Cell');
            });

            test('should throw parsing_error for invalid cell BoC format', async () => {
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
                const error = await expectThrowingError(() => ta.execGetMethodForBlockchainAccount(address, 'get_data'));

                assertIsParsingError(error);
                expect(error.parsingType).toBe('Cell');
            });

            test('should throw parsing_error for odd length hex string', async () => {
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
                const error = await expectThrowingError(() => ta.execGetMethodForBlockchainAccount(address, 'get_data'));

                assertIsParsingError(error);
                expect(error.parsingType).toBe('Cell');
            });

            test('should throw parsing_error for non-hex characters in cell', async () => {
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
                const error = await expectThrowingError(() => ta.execGetMethodForBlockchainAccount(address, 'get_data'));

                assertIsParsingError(error);
                expect(error.parsingType).toBe('Cell');
            });
        });

        describe('Invalid BigInt parsing', () => {
            test('should throw parsing_error for non-numeric BigInt string', async () => {
                mockFetch({
                    address: 'EQAvDfWFG0oYX19jwNDNBBL1rKNT9XfaGP9HyTb5nb2Eml6y',
                    balance: 'not-a-number',
                    status: 'active'
                });

                const validAddress = Address.parse('EQAvDfWFG0oYX19jwNDNBBL1rKNT9XfaGP9HyTb5nb2Eml6y');
                const error = await expectThrowingError(() => ta.getAccount(validAddress));

                assertIsParsingError(error);
                expect(error.parsingType).toBe('BigInt');
            });

            test('should throw parsing_error for invalid BigInt format', async () => {
                mockFetch({
                    address: 'EQAvDfWFG0oYX19jwNDNBBL1rKNT9XfaGP9HyTb5nb2Eml6y',
                    balance: '123.456', // Decimal number, BigInt doesn't support decimals
                    status: 'active'
                });

                const validAddress = Address.parse('EQAvDfWFG0oYX19jwNDNBBL1rKNT9XfaGP9HyTb5nb2Eml6y');
                const error = await expectThrowingError(() => ta.getAccount(validAddress));

                assertIsParsingError(error);
                expect(error.parsingType).toBe('BigInt');
            });

            test('should handle empty string in BigInt field (converts to 0n)', async () => {
                // Note: BigInt('') actually returns 0n, not an error
                mockFetch({
                    address: 'EQAvDfWFG0oYX19jwNDNBBL1rKNT9XfaGP9HyTb5nb2Eml6y',
                    balance: '',
                    status: 'active'
                });

                const validAddress = Address.parse('EQAvDfWFG0oYX19jwNDNBBL1rKNT9XfaGP9HyTb5nb2Eml6y');
                const result = await ta.getAccount(validAddress);

                // Empty string converts to 0n without error
                expect(result).toBeDefined();
                expect(result?.balance).toBe(0n);
            });
        });

        describe('Invalid TupleItem type', () => {
            test('should throw parsing_error for unknown tuple item type', async () => {
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
                const error = await expectThrowingError(() => ta.execGetMethodForBlockchainAccount(address, 'get_data'));

                assertIsParsingError(error);
                expect(error.parsingType).toBe('TupleItem');
            });

            test('should throw parsing_error for invalid type in nested tuple', async () => {
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
                const error = await expectThrowingError(() => ta.execGetMethodForBlockchainAccount(address, 'get_data'));

                assertIsParsingError(error);
                expect(error.parsingType).toBe('TupleItem');
            });
        });

        describe('Error structure validation', () => {
            test('should have all required properties', async () => {
                mockFetch({
                    address: 'invalid',
                    balance: '1000000000',
                    status: 'active'
                });

                const validAddress = Address.parse('EQAvDfWFG0oYX19jwNDNBBL1rKNT9XfaGP9HyTb5nb2Eml6y');
                const error = await expectThrowingError(() => ta.getAccount(validAddress));

                assertIsParsingError(error);

                // Verify all required properties
                expect(error).toHaveProperty('message');
                expect(error).toHaveProperty('type');
                expect(error).toHaveProperty('parsingType');
                expect(error).toHaveProperty('originalCause');
                expect(error).toHaveProperty('response');

                expect(typeof error.message).toBe('string');
                expect(error.type).toBe('parsing_error');
                expect(['Address', 'Cell', 'BigInt', 'TupleItem', 'Unknown']).toContain(error.parsingType);
            });

            test('parsing_error should have correct structure', async () => {
                mockFetch({
                    address: 'invalid',
                    balance: '1000000000',
                    status: 'active'
                });

                const validAddress = Address.parse('EQAvDfWFG0oYX19jwNDNBBL1rKNT9XfaGP9HyTb5nb2Eml6y');
                const error = await expectThrowingError(() => ta.getAccount(validAddress));

                assertIsParsingError(error);

                // Verify error structure
                expect(error).toHaveProperty('message');
                expect(error).toHaveProperty('type');
                expect(error).toHaveProperty('parsingType');
                expect(error).toHaveProperty('originalCause');

                expect(typeof error?.message).toBe('string');
                expect(error?.type).toBe('parsing_error');
            });

            test('originalCause should contain the original error', async () => {
                mockFetch({
                    address: 'invalid-address',
                    balance: '1000000000',
                    status: 'active'
                });

                const validAddress = Address.parse('EQAvDfWFG0oYX19jwNDNBBL1rKNT9XfaGP9HyTb5nb2Eml6y');
                const error = await expectThrowingError(() => ta.getAccount(validAddress));

                assertIsParsingError(error);
                expect(error.originalCause).toBeDefined();
                expect(error.parsingType).toBe('Address');
            });
        });
    });
});

// ============================================================================
// ADVANCED APPROACH: Global methods with {data, error} return pattern
// ============================================================================

describe('Advanced API - Global methods (returns {data, error})', () => {
    beforeEach(() => {
        initTa();
    });

    test('should return a successful response with JSON data', async () => {
        const mockData = { rest_online: true, indexing_latency: 8 };
        const fetchSpy = mockFetch(mockData);

        const { data, error } = await status();
        expect(error).toBeNull();
        expect(data).toBeDefined();
        // Response is converted to camelCase
        expect(data?.restOnline).toBe(true);
        expect(data?.indexingLatency).toBe(8);
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
        assertIsHttpError(error);
        expect(error.message).toContain('Invalid request');
        expect(error.status).toBe(400);
        expect(error.type).toBe('http_error');
    });
});
