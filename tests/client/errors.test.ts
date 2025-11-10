import { ta } from './utils/client';
import { vi, test, expect, afterEach, beforeEach } from 'vitest';
import { mockFetch } from './utils/mockFetch';

beforeEach(() => {
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

    const { data, error } = await ta.utilities.status();
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

    const { data, error } = await ta.utilities.status();
    expect(data).toBeNull();
    expect(error).not.toBeNull();
    expect(error?.message).toBe('Invalid request');
    expect(error?.status).toBe(400);
    expect(error?.type).toBe('http_error');
});

test('should handle an error response with a string message', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(createJsonResponse('Simple error message', 500));

    const { data, error } = await ta.utilities.status();
    expect(data).toBeNull();
    expect(error).not.toBeNull();
    expect(error?.message).toBe('Simple error message');
    expect(error?.status).toBe(500);
    expect(error?.type).toBe('http_error');
});

test('should include cause in the error object', async () => {
    const mockError = { error: 'Invalid request' };
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(createJsonResponse(mockError, 400));

    const { data, error } = await ta.utilities.status();
    expect(data).toBeNull();
    expect(error).not.toBeNull();
    expect(error?.message).toBe('Invalid request');
    expect(error?.cause).toBeDefined();
    expect(error?.type).toBe('http_error');
});

test('should handle an error response without JSON', async () => {
    const mockError = new Error('Network failure');
    vi.spyOn(global, 'fetch').mockRejectedValueOnce(mockError);

    const { data, error } = await ta.utilities.status();
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

    const { data, error } = await ta.utilities.status();
    expect(data).toBeNull();
    expect(error).not.toBeNull();
    expect(error?.message).toContain('Failed to parse error response');
    expect(error?.status).toBe(400);
    expect(error?.type).toBe('http_error');
});

test('should handle an unknown error type (object)', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValueOnce({ message: 'Some unknown error' } as any);

    const { data, error } = await ta.utilities.status();
    expect(data).toBeNull();
    expect(error).not.toBeNull();
    expect(error?.message).toBe('Unknown error occurred');
});

test('should handle an unknown error type (string)', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValueOnce('Some unknown error' as any);

    const { data, error } = await ta.utilities.status();
    expect(data).toBeNull();
    expect(error).not.toBeNull();
    expect(error?.message).toBe('Unknown error occurred');
});

test('should handle null as an error', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValueOnce(null as any);

    const { data, error } = await ta.utilities.status();
    expect(data).toBeNull();
    expect(error).not.toBeNull();
    expect(error?.message).toBe('Unknown error occurred');
});

test('should handle undefined as an error', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValueOnce(undefined as any);

    const { data, error } = await ta.utilities.status();
    expect(data).toBeNull();
    expect(error).not.toBeNull();
    expect(error?.message).toBe('Unknown error occurred');
});

test('should handle a JSON error response without an error field', async () => {
    const mockError = { message: 'Some error without error field' };
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(createJsonResponse(mockError, 400));

    const { data, error } = await ta.utilities.status();
    expect(data).toBeNull();
    expect(error).not.toBeNull();
    expect(error?.message).toBe('Some error without error field');
    expect(error?.status).toBe(400);
    expect(error?.type).toBe('http_error');
});
