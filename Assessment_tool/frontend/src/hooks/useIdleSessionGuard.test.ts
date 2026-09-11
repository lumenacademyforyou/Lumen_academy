import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useIdleSessionGuard } from './useIdleSessionGuard';
import * as authSessionApi from '../services/authSessionApi';

// Phase F2 (LA-APP-COMPLETION-001) — real behaviour, not "does it render":
// this hook is the client-side half of Phase E's idle-timeout warning, and
// its whole point is timing/threshold logic, so it's asserted against fake
// timers rather than snapshotted.

function statusAt(lastActivityAgoMs: number, idleTimeoutMs = 30 * 60 * 1000, absoluteAgoMs = 60 * 60 * 1000) {
  const now = Date.now();
  return {
    sessionId: 's1',
    issuedAt: new Date(now - absoluteAgoMs).toISOString(),
    lastActivityAt: new Date(now - lastActivityAgoMs).toISOString(),
    absoluteExpiresAt: new Date(now - absoluteAgoMs + 12 * 60 * 60 * 1000).toISOString(),
    idleTimeoutMs,
    serverNow: new Date(now).toISOString(),
  };
}

describe('useIdleSessionGuard', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('does nothing when disabled', async () => {
    const getStatus = vi.spyOn(authSessionApi, 'getSessionStatus');
    const onExpire = vi.fn();
    renderHook(() => useIdleSessionGuard(false, onExpire));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(getStatus).not.toHaveBeenCalled();
  });

  it('shows the warning once the idle deadline is within the 2-minute threshold', async () => {
    // 29 minutes since last activity, 30-minute idle timeout -> 1 minute left,
    // inside the warning window.
    vi.spyOn(authSessionApi, 'getSessionStatus').mockResolvedValue(statusAt(29 * 60 * 1000));
    const onExpire = vi.fn();
    const { result } = renderHook(() => useIdleSessionGuard(true, onExpire));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000); // let the initial status poll resolve + one tick
    });

    expect(result.current.showWarning).toBe(true);
    expect(result.current.secondsRemaining).toBeGreaterThan(0);
    expect(result.current.secondsRemaining).toBeLessThanOrEqual(60);
    expect(onExpire).not.toHaveBeenCalled();
  });

  it('does not show the warning while comfortably inside the idle window', async () => {
    vi.spyOn(authSessionApi, 'getSessionStatus').mockResolvedValue(statusAt(5 * 60 * 1000)); // 5 min ago, 25 min left
    const onExpire = vi.fn();
    const { result } = renderHook(() => useIdleSessionGuard(true, onExpire));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(result.current.showWarning).toBe(false);
    expect(onExpire).not.toHaveBeenCalled();
  });

  it('calls onExpire with "idle_timeout" once the deadline is reached, and stops before that', async () => {
    // 29:58 since last activity -> 2s left on a 30-minute idle window.
    vi.spyOn(authSessionApi, 'getSessionStatus').mockResolvedValue(statusAt(30 * 60 * 1000 - 2000));
    const onExpire = vi.fn();
    renderHook(() => useIdleSessionGuard(true, onExpire));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000); // status poll resolves, 1s tick — should not have expired yet
    });
    expect(onExpire).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000); // crosses the deadline
    });
    expect(onExpire).toHaveBeenCalledWith('idle_timeout');
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it('reports "absolute_timeout" as the reason when the absolute cap is the nearer deadline', async () => {
    // Idle clock has 20 minutes left (recent activity), but the absolute
    // session cap is only 2 seconds away — the nearer of the two must win.
    const now = Date.now();
    vi.spyOn(authSessionApi, 'getSessionStatus').mockResolvedValue({
      sessionId: 's1',
      issuedAt: new Date(now - 12 * 60 * 60 * 1000).toISOString(),
      lastActivityAt: new Date(now - 60_000).toISOString(),
      absoluteExpiresAt: new Date(now + 2000).toISOString(),
      idleTimeoutMs: 30 * 60 * 1000,
      serverNow: new Date(now).toISOString(),
    });
    const onExpire = vi.fn();
    renderHook(() => useIdleSessionGuard(true, onExpire));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(onExpire).toHaveBeenCalledWith('absolute_timeout');
  });

  it('stayActive sends a heartbeat and dismisses the warning', async () => {
    vi.spyOn(authSessionApi, 'getSessionStatus')
      .mockResolvedValueOnce(statusAt(29 * 60 * 1000)) // initial poll: inside warning window
      .mockResolvedValue(statusAt(0)); // after heartbeat: fully fresh
    const heartbeat = vi.spyOn(authSessionApi, 'sendHeartbeat').mockResolvedValue(undefined);
    const onExpire = vi.fn();
    const { result } = renderHook(() => useIdleSessionGuard(true, onExpire));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(result.current.showWarning).toBe(true);

    await act(async () => {
      result.current.stayActive();
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(heartbeat).toHaveBeenCalledTimes(1);
    expect(result.current.showWarning).toBe(false);
  });

  it('does not send more than one heartbeat within the throttle window even with repeated activity', async () => {
    vi.spyOn(authSessionApi, 'getSessionStatus').mockResolvedValue(statusAt(5 * 60 * 1000));
    const heartbeat = vi.spyOn(authSessionApi, 'sendHeartbeat').mockResolvedValue(undefined);
    renderHook(() => useIdleSessionGuard(true, vi.fn()));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    await act(async () => {
      window.dispatchEvent(new Event('mousemove'));
      window.dispatchEvent(new Event('mousemove'));
      window.dispatchEvent(new Event('keydown'));
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(heartbeat).toHaveBeenCalledTimes(1);
  });
});
