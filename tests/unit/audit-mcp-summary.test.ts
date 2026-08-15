import { summarizeRequestArgs, summarizeResponse, extractErrorCode } from '../../src/utils/audit-mcp-summary.js';

describe('audit-mcp-summary', () => {
  describe('summarizeRequestArgs', () => {
    it('returns empty object for null args', () => {
      expect(summarizeRequestArgs('activate', null)).toEqual({});
    });

    it('sanitizes basic arguments', () => {
      const result = summarizeRequestArgs('activate', { query: 'find workflow' });
      expect(result).toHaveProperty('query', 'find workflow');
    });

    it('redacts bearer tokens in string values', () => {
      const result = summarizeRequestArgs('activate', { token: 'Bearer abc123secret' });
      expect(result).toHaveProperty('token', '[REDACTED]');
    });

    it('truncates long strings to 2048 chars', () => {
      const longString = 'x'.repeat(3000);
      const result = summarizeRequestArgs('activate', { data: longString });
      expect((result as any).data.length).toBeLessThanOrEqual(2062); // 2048 + '...[truncated]'
      expect((result as any).data).toContain('...[truncated]');
    });

    it('excludes raw content for train at level 2 (length only)', () => {
      const content = '# My Adapter\n\nSome content here';
      const result = summarizeRequestArgs('train', {
        content,
        llm_model_id: 'gpt-4',
        force_update: true
      });
      expect(result).toHaveProperty('content_length', content.length);
      expect(result).not.toHaveProperty('content');
      expect(result).toHaveProperty('llm_model_id', 'gpt-4');
      expect(result).toHaveProperty('force_update', true);
    });

    it('caps arrays at 50 items with truncation metadata', () => {
      const largeArray = Array.from({ length: 100 }, (_, i) => `item-${i}`);
      const result = summarizeRequestArgs('test', { items: largeArray });
      const itemsResult = result as any;
      expect(itemsResult.items.items.length).toBe(50);
      expect(itemsResult.items._truncated).toBe(true);
      expect(itemsResult.items._original_count).toBe(100);
    });

    it('handles non-object args gracefully', () => {
      expect(summarizeRequestArgs('test', 'string')).toEqual({});
      expect(summarizeRequestArgs('test', 123)).toEqual({});
    });
  });

  describe('summarizeResponse', () => {
    it('wraps non-object results', () => {
      const result = summarizeResponse('test', 'simple string');
      expect(result).toHaveProperty('raw');
    });

    it('sanitizes MCP tool result with content array', () => {
      const mockResult = {
        content: [
          { type: 'text', text: 'Success message' }
        ],
        isError: false
      };
      const result = summarizeResponse('activate', mockResult);
      expect(result).toHaveProperty('isError', false);
      expect(result).toHaveProperty('content');
      expect(Array.isArray((result as any).content)).toBe(true);
      expect((result as any).content[0]).toHaveProperty('type', 'text');
      expect((result as any).content[0]).toHaveProperty('text', 'Success message');
    });

    it('truncates long text in content items', () => {
      const longText = 'x'.repeat(3000);
      const mockResult = {
        content: [{ type: 'text', text: longText }]
      };
      const result = summarizeResponse('test', mockResult);
      const textContent = (result as any).content[0].text;
      expect(textContent.length).toBeLessThanOrEqual(2048);
      expect((result as any).content[0]._text_truncated).toBe(true);
    });

    it('redacts secrets in response text', () => {
      const mockResult = {
        content: [{ type: 'text', text: 'Token: Bearer secret123' }]
      };
      const result = summarizeResponse('test', mockResult);
      expect((result as any).content[0].text).toBe('Token: [REDACTED]');
    });

    it('caps content array at 50 items', () => {
      const largeContent = Array.from({ length: 100 }, (_, i) => ({
        type: 'text',
        text: `item-${i}`
      }));
      const mockResult = { content: largeContent };
      const result = summarizeResponse('test', mockResult);
      expect((result as any).content.length).toBe(50);
      expect((result as any)._content_truncated).toBe(true);
    });
  });

  describe('extractErrorCode', () => {
    it('returns undefined for null result', () => {
      expect(extractErrorCode(null)).toBeUndefined();
    });

    it('extracts direct error_code field', () => {
      const result = { error_code: 'VALIDATION_ERROR' };
      expect(extractErrorCode(result)).toBe('VALIDATION_ERROR');
    });

    it('extracts error_code from MCP error content', () => {
      const mockResult = {
        isError: true,
        content: [
          {
            type: 'text',
            text: JSON.stringify({ error_code: 'AUTH_FAILED', message: 'Invalid token' })
          }
        ]
      };
      expect(extractErrorCode(mockResult)).toBe('AUTH_FAILED');
    });

    it('extracts error_code from nested data field', () => {
      const mockResult = {
        isError: true,
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              code: -32603,
              data: { error_code: 'SERVER_ERROR' }
            })
          }
        ]
      };
      expect(extractErrorCode(mockResult)).toBe('SERVER_ERROR');
    });

    it('extracts error_code via regex for non-JSON text', () => {
      const mockResult = {
        isError: true,
        content: [
          {
            type: 'text',
            text: '{"error_code": "PARSE_ERROR", "detail": "bad input"}'
          }
        ]
      };
      expect(extractErrorCode(mockResult)).toBe('PARSE_ERROR');
    });

    it('returns undefined when no error_code present', () => {
      const mockResult = {
        isError: true,
        content: [{ type: 'text', text: 'Something went wrong' }]
      };
      expect(extractErrorCode(mockResult)).toBeUndefined();
    });
  });
});
