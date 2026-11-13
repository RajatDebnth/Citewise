import { useEffect, useState } from 'react';
import { healthApi } from '../services/api';

export function useServerWake() {
  const [isWaking, setIsWaking] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    let isCancelled = false;

    // Start 3 second threshold timer
    timer = setTimeout(() => {
      if (!isCancelled) {
        setIsWaking(true);
      }
    }, 3000);

    // Ping health endpoint
    healthApi
      .check()
      .then(() => {
        if (!isCancelled) {
          setIsReady(true);
          setIsWaking(false);
        }
      })
      .catch((err) => {
        console.warn('Server wake check initial error, server may be starting:', err);
      })
      .finally(() => {
        if (timer) {
          clearTimeout(timer);
        }
      });

    return () => {
      isCancelled = true;
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, []);

  return { isWaking, isReady };
}

