import { status, getAccount, execGetMethodForBlockchainAccount, TonApiParsingError, TonApiHttpError, TonApiNetworkError, TonApiUnknownError } from '@ton-api/client';
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
    assertIsHttpError(error);
    expect(error.message).toBe('HTTP 400: Invalid request');
    expect(error.status).toBe(400);
    expect(error.type).toBe('http_error');
});

test('should handle an error response with a string message', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(createJsonResponse('Simple error message', 500));

    const { data, error } = await status();
    expect(data).toBeNull();
    expect(error).not.toBeNull();
    assertIsHttpError(error);
    expect(error.message).toBe('HTTP 500: Simple error message');
    expect(error.status).toBe(500);
    expect(error.type).toBe('http_error');
});

test('should include cause in the error object', async () => {
    const mockError = { error: 'Invalid request' };
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(createJsonResponse(mockError, 400));

    const { data, error } = await status();
    expect(data).toBeNull();
    expect(error).not.toBeNull();
    expect(error?.message).toBe('HTTP 400: Invalid request');
    expect(error).toBeDefined();
    expect(error?.type).toBe('http_error');
});

test('should handle an error response without JSON', async () => {
    const mockError = new Error('Network failure');
    vi.spyOn(global, 'fetch').mockRejectedValueOnce(mockError);

    const { data, error } = await status();
    expect(data).toBeNull();
    expect(error).not.toBeNull();
    expect(error?.message).toBe('Network error: Network failure');
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
    assertIsHttpError(error);
    expect(error.message).toContain('Failed to parse error response');
    expect(error.status).toBe(400);
    expect(error.type).toBe('http_error');
});

test('should handle an unknown error type (object)', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValueOnce({ message: 'Some unknown error' } as any);

    const { data, error } = await status();
    expect(data).toBeNull();
    expect(error).not.toBeNull();
    expect(error).toBeInstanceOf(TonApiUnknownError);
    expect(error?.message).toBe('Unknown error: Unknown error occurred');
    expect(error?.type).toBe('unknown_error');
});

test('should handle an unknown error type (string)', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValueOnce('Some unknown error' as any);

    const { data, error } = await status();
    expect(data).toBeNull();
    expect(error).not.toBeNull();
    expect(error).toBeInstanceOf(TonApiUnknownError);
    expect(error?.message).toBe('Unknown error: Unknown error occurred');
    expect(error?.type).toBe('unknown_error');
});

test('should handle null as an error', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValueOnce(null as any);

    const { data, error } = await status();
    expect(data).toBeNull();
    expect(error).not.toBeNull();
    expect(error).toBeInstanceOf(TonApiUnknownError);
    expect(error?.message).toBe('Unknown error: Unknown error occurred');
    expect(error?.type).toBe('unknown_error');
});

test('should handle undefined as an error', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValueOnce(undefined as any);

    const { data, error } = await status();
    expect(data).toBeNull();
    expect(error).not.toBeNull();
    expect(error).toBeInstanceOf(TonApiUnknownError);
    expect(error?.message).toBe('Unknown error: Unknown error occurred');
    expect(error?.type).toBe('unknown_error');
});

test('should handle a JSON error response without an error field', async () => {
    const mockError = { message: 'Some error without error field' };
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(createJsonResponse(mockError, 400));

    const { data, error } = await status();
    expect(data).toBeNull();
    expect(error).not.toBeNull();
    assertIsHttpError(error);
    expect(error.message).toBe('HTTP 400: Some error without error field');
    expect(error.status).toBe(400);
    expect(error.type).toBe('http_error');
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
            assertIsParsingError(error);
            expect(error.parsingType).toBe('Address');
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
            assertIsParsingError(error);
            expect(error.parsingType).toBe('Address');
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
            assertIsParsingError(error);
            expect(error.parsingType).toBe('Address');
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
            assertIsParsingError(error);
            expect(error.parsingType).toBe('Cell');
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
            assertIsParsingError(error);
            expect(error.parsingType).toBe('Cell');
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
            assertIsParsingError(error);
            expect(error.parsingType).toBe('Cell');
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
            assertIsParsingError(error);
            expect(error.parsingType).toBe('Cell');
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
            expect(error).toBeDefined();
            assertIsParsingError(error);
            expect(error.parsingType).toBe('BigInt');
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
            
            assertIsParsingError(error);
            if (error instanceof TonApiParsingError) {
                expect(error.parsingType).toBe('BigInt');
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
            
            expect(error?.message).toContain('Unknown tuple item type');
            assertIsParsingError(error);
            expect(error.parsingType).toBe('TupleItem');
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
            
            expect(error?.message).toContain('Unknown tuple item type');
            assertIsParsingError(error);
            expect(error.parsingType).toBe('TupleItem');
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
            assertIsParsingError(error);

            // Verify error structure
            expect(error).toHaveProperty('message');
            expect(error).toHaveProperty('type');
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
            const { data, error } = await getAccount(validAddress);

            assertIsParsingError(error);
            expect(error.originalCause).toBeDefined();
            expect(error.parsingType).toBe('Address');
        });
    });
});

describe('instanceof error checks', () => {
    test('TonApiHttpError instanceof check', async () => {
        const mockError = { error: 'Not found' };
        vi.spyOn(global, 'fetch').mockResolvedValueOnce(createJsonResponse(mockError, 404));

        const { data, error } = await status();

        expect(error).not.toBeNull();
        expect(error).toBeInstanceOf(TonApiHttpError);

        // TypeScript should narrow the type
        if (error instanceof TonApiHttpError) {
            expect(error.status).toBe(404);
            expect(error.message).toBe('HTTP 404: Not found');
            expect(error.type).toBe('http_error');
            expect(error.url).toBeDefined();
        }
    });

    test('TonApiNetworkError instanceof check', async () => {
        vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Network connection failed'));

        const { data, error } = await status();

        expect(error).not.toBeNull();
        assertIsNetworkError(error);
        expect(error.message).toBe('Network error: Network connection failed');
        expect(error.type).toBe('network_error');
        expect(error.originalCause).toBeInstanceOf(Error);
    });

    test('TonApiParsingError instanceof check', async () => {
        mockFetch({
            address: 'INVALID_ADDRESS_FORMAT',
            balance: '1000000000',
            status: 'active'
        });

        const validAddress = Address.parse('EQAvDfWFG0oYX19jwNDNBBL1rKNT9XfaGP9HyTb5nb2Eml6y');
        const { data, error } = await getAccount(validAddress);

        expect(error).not.toBeNull();
        assertIsParsingError(error);
        expect(error.parsingType).toBe('Address');
        expect(error.type).toBe('parsing_error');
        expect(error.message).toBeDefined();
        expect(error.originalCause).toBeDefined();
    });

    test('TonApiUnknownError instanceof check', async () => {
        vi.spyOn(global, 'fetch').mockRejectedValueOnce({ something: 'unexpected' } as any);

        const { data, error } = await status();

        expect(error).not.toBeNull();
        assertIsUnknownError(error);
        expect(error.message).toBe('Unknown error: Unknown error occurred');
        expect(error.type).toBe('unknown_error');
        expect(error.originalCause).toBeDefined();
    });
});

describe('discriminated union error handling', () => {
    test('should handle errors using switch/case on type', async () => {
        const mockError = { error: 'Bad request', code: 'INVALID_PARAMS' };
        vi.spyOn(global, 'fetch').mockResolvedValueOnce(createJsonResponse(mockError, 400));

        const { data, error } = await status();

        expect(error).not.toBeNull();
        expect(error).toBeDefined();

        if (!error) {
            expect.fail('Expected error to be defined');
            return;
        }

        switch (error.type) {
            case 'http_error':
                expect(error.status).toBe(400);
                expect(error.code).toBe('INVALID_PARAMS');
                expect(error.url).toBeDefined();
                break;
            case 'network_error':
                expect(error.originalCause).toBeDefined();
                break;
            case 'parsing_error':
                expect(error.parsingType).toBeDefined();
                break;
            case 'unknown_error':
                expect(error.originalCause).toBeDefined();
                break;
            default:
                expect.fail(`Unexpected error type: ${(error as any).type}`);
        }
    });

    test('should handle network error using switch/case', async () => {
        vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Timeout'));

        const { data, error } = await status();

        expect(error).not.toBeNull();
        expect(error).toBeDefined();

        if (!error) {
            expect.fail('Expected error to be defined');
            return;
        }

        switch (error.type) {
            case 'http_error':
                expect.fail('Expected network error, got HTTP error');
                break;
            case 'network_error':
                expect(error.message).toBe('Network error: Timeout');
                break;
            case 'parsing_error':
                expect.fail('Expected network error, got parsing error');
                break;
            case 'unknown_error':
                expect.fail('Expected network error, got unknown error');
                break;
            default:
                expect.fail(`Unexpected error type: ${(error as any).type}`);
        }
    });

    test('all error types have message property', async () => {
        // Test HTTP error
        const mockError = { error: 'Server error' };
        vi.spyOn(global, 'fetch').mockResolvedValueOnce(createJsonResponse(mockError, 500));

        const { error: httpError } = await status();
        assertIsHttpError(httpError);
        expect(httpError.message).toBe('HTTP 500: Server error');

        // Test Network error
        vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Connection failed'));
        const { error: networkError } = await status();
        assertIsNetworkError(networkError);
        expect(networkError.message).toBe('Network error: Connection failed');

        // Test Parsing error
        mockFetch({ address: 'INVALID', balance: '0', status: 'active' });
        const { error: parsingError } = await getAccount(Address.parse('EQAvDfWFG0oYX19jwNDNBBL1rKNT9XfaGP9HyTb5nb2Eml6y'));
        assertIsParsingError(parsingError);
        expect(parsingError.message).toBeDefined();

        // Test Unknown error
        vi.spyOn(global, 'fetch').mockRejectedValueOnce('something weird' as any);
        const { error: unknownError } = await status();
        assertIsUnknownError(unknownError);
        expect(unknownError.message).toBe('Unknown error: Unknown error occurred');
    });

    test('should handle unknown error using switch/case', async () => {
        vi.spyOn(global, 'fetch').mockRejectedValueOnce({ weird: 'object' } as any);

        const { data, error } = await status();

        expect(error).not.toBeNull();
        expect(error).toBeDefined();

        if (!error) {
            expect.fail('Expected error to be defined');
            return;
        }

        switch (error.type) {
            case 'http_error':
                expect.fail('Expected unknown error, got HTTP error');
                break;
            case 'network_error':
                expect.fail('Expected unknown error, got network error');
                break;
            case 'parsing_error':
                expect.fail('Expected unknown error, got parsing error');
                break;
            case 'unknown_error':
                expect(error.message).toBe('Unknown error: Unknown error occurred');
                expect(error.originalCause).toBeDefined();
                break;
            default:
                expect.fail(`Unexpected error type: ${(error as any).type}`);
        }
    });
});
