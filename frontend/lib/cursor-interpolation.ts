import { useRef, useEffect, useCallback } from 'react';

interface CursorPosition {
  x: number;
  y: number;
  timestamp: number;
}

interface InterpolatedCursor {
  email: string;
  current: CursorPosition;
  target: CursorPosition;
  velocity: { x: number; y: number };
  isMoving: boolean;
}

export class CursorInterpolator {
  private cursors = new Map<string, InterpolatedCursor>();
  private animationId: number | null = null;
  private lastUpdate = 0;
  
  constructor(private onUpdate: (email: string, x: number, y: number) => void) {}

  updateCursor(email: string, x: number, y: number) {
    const timestamp = Date.now();
    const existing = this.cursors.get(email);
    
    if (existing) {
      // Calculate velocity based on time and distance
      const timeDelta = timestamp - existing.target.timestamp;
      const distanceX = x - existing.target.x;
      const distanceY = y - existing.target.y;
      
      existing.velocity = {
        x: timeDelta > 0 ? distanceX / timeDelta : 0,
        y: timeDelta > 0 ? distanceY / timeDelta : 0
      };
      
      existing.target = { x, y, timestamp };
      existing.isMoving = true;
    } else {
      // New cursor - start at target position
      this.cursors.set(email, {
        email,
        current: { x, y, timestamp },
        target: { x, y, timestamp },
        velocity: { x: 0, y: 0 },
        isMoving: false
      });
    }
    
    this.startAnimation();
  }

  removeCursor(email: string) {
    this.cursors.delete(email);
    if (this.cursors.size === 0) {
      this.stopAnimation();
    }
  }

  getCursorPosition(email: string): { x: number; y: number } | null {
    const cursor = this.cursors.get(email);
    return cursor ? { x: cursor.current.x, y: cursor.current.y } : null;
  }

  private startAnimation() {
    if (this.animationId) return;
    
    this.lastUpdate = Date.now();
    this.animationId = requestAnimationFrame(this.animate.bind(this));
  }

  private stopAnimation() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  private animate() {
    const now = Date.now();
    const deltaTime = now - this.lastUpdate;
    this.lastUpdate = now;
    
    let hasMovingCursors = false;
    
    for (const cursor of this.cursors.values()) {
      const { current, target } = cursor;
      
      // Calculate distance to target
      const dx = target.x - current.x;
      const dy = target.y - current.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance > 0.5) {
        // Use easing function for smooth movement
        const easeFactor = Math.min(1, deltaTime / 16); // Normalize to 60fps
        const lerpFactor = 1 - Math.pow(0.05, easeFactor); // Exponential ease-out
        
        current.x += dx * lerpFactor;
        current.y += dy * lerpFactor;
        current.timestamp = now;
        
        this.onUpdate(cursor.email, current.x, current.y);
        cursor.isMoving = true;
        hasMovingCursors = true;
      } else {
        // Snap to target when very close
        if (cursor.isMoving) {
          current.x = target.x;
          current.y = target.y;
          this.onUpdate(cursor.email, current.x, current.y);
          cursor.isMoving = false;
        }
      }
    }
    
    if (hasMovingCursors) {
      this.animationId = requestAnimationFrame(this.animate.bind(this));
    } else {
      this.animationId = null;
    }
  }

  destroy() {
    this.stopAnimation();
    this.cursors.clear();
  }
}

export const useCursorInterpolation = (onUpdate: (email: string, x: number, y: number) => void) => {
  const interpolatorRef = useRef<CursorInterpolator | null>(null);
  
  useEffect(() => {
    interpolatorRef.current = new CursorInterpolator(onUpdate);
    
    return () => {
      interpolatorRef.current?.destroy();
    };
  }, [onUpdate]);
  
  const updateCursor = useCallback((email: string, x: number, y: number) => {
    interpolatorRef.current?.updateCursor(email, x, y);
  }, []);
  
  const removeCursor = useCallback((email: string) => {
    interpolatorRef.current?.removeCursor(email);
  }, []);
  
  const getCursorPosition = useCallback((email: string) => {
    return interpolatorRef.current?.getCursorPosition(email) || null;
  }, []);
  
  return { updateCursor, removeCursor, getCursorPosition };
}; 