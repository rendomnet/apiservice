import { HookManager } from '../../src/HookManager';
import { HookSettings } from '../../src/types';

describe('HookManager', () => {
  let hookManager: HookManager;

  beforeEach(() => {
    hookManager = new HookManager();
  });

  it('clears hookPromises even if handler fails when preventConcurrentCalls is true', async () => {
    const onHandlerError = jest.fn().mockResolvedValue(undefined);
    const handler = jest.fn()
      .mockRejectedValueOnce(new Error('First failure'))
      .mockResolvedValueOnce({ updated: true });

    const hook: HookSettings = {
      shouldRetry: true,
      useRetryDelay: false,
      preventConcurrentCalls: true,
      handler,
      onHandlerError,
    };

    hookManager.setHooks({ 401: hook });

    // First attempt - should fail
    await expect(hookManager.processHook('acc1', 401, { response: {} }))
      .rejects.toThrow('First failure');

    expect(onHandlerError).toHaveBeenCalledWith('acc1', expect.any(Error));
    
    // Second attempt - should succeed if promise was cleared
    const result = await hookManager.processHook('acc1', 401, { response: {} });
    expect(result).toEqual({ updated: true });
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('calls onHandlerError when handler throws', async () => {
    const onHandlerError = jest.fn().mockResolvedValue(undefined);
    const hook: HookSettings = {
      shouldRetry: true,
      useRetryDelay: false,
      handler: async () => { throw new Error('Hook failed'); },
      onHandlerError,
    };

    hookManager.setHooks({ 500: hook });

    await expect(hookManager.processHook('acc1', 500, { response: {} }))
      .rejects.toThrow('Hook failed');

    expect(onHandlerError).toHaveBeenCalledWith('acc1', expect.any(Error));
  });

  it('supports concurrent calls by returning the same promise', async () => {
    let resolveHook: (value: any) => void;
    const hookPromise = new Promise((resolve) => {
      resolveHook = resolve;
    });

    const handler = jest.fn().mockReturnValue(hookPromise);
    const hook: HookSettings = {
      shouldRetry: true,
      useRetryDelay: false,
      preventConcurrentCalls: true,
      handler,
    };

    hookManager.setHooks({ 401: hook });

    const call1 = hookManager.processHook('acc1', 401, { response: {} });
    const call2 = hookManager.processHook('acc1', 401, { response: {} });

    // Ensure handler called only once
    expect(handler).toHaveBeenCalledTimes(1);

    resolveHook!({ refreshed: true });

    const [res1, res2] = await Promise.all([call1, call2]);
    expect(res1).toEqual({ refreshed: true });
    expect(res2).toEqual({ refreshed: true });
  });
});
