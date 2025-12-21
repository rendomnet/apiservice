
import { FetchError } from '../../src/FetchError';

describe('FetchError', () => {
  it('should extract message properly when nested', () => {
    const response = { status: 400, statusText: 'Bad Request' } as Response;
    const data = { error: { message: 'Nested error' } };
    const error = new FetchError(response, data);
    expect(error.message).toBe('Nested error');
  });

  it('should extract message properly when data.message exists', () => {
    const response = { status: 400, statusText: 'Bad Request' } as Response;
    const data = { message: 'Direct message' };
    const error = new FetchError(response, data);
    expect(error.message).toBe('Direct message');
  });

  it('should extract message properly when data.error is a string', () => {
    const response = { status: 400, statusText: 'Bad Request' } as Response;
    const data = { version: 2, success: false, error: 'Simple string error' };
    const error = new FetchError(response, data);
    expect(error.message).toBe('Simple string error');
  });

  it('should fallback to statusText if no message in data', () => {
    const response = { status: 404, statusText: 'Not Found' } as Response;
    const data = {};
    const error = new FetchError(response, data);
    expect(error.message).toBe('Not Found');
  });
});
