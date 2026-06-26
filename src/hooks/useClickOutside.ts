import { useEffect, useRef } from 'react';

export function useClickOutside<T extends HTMLElement>(
  handler: () => void,
  excludeRefs?: React.RefObject<HTMLElement>[]
) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      // If clicking inside the target element, do nothing
      if (ref.current && ref.current.contains(event.target as Node)) {
        return;
      }

      // If clicking inside any excluded element, do nothing
      if (excludeRefs) {
        for (const excludeRef of excludeRefs) {
          if (excludeRef.current && excludeRef.current.contains(event.target as Node)) {
            return;
          }
        }
      }

      handler();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [handler, excludeRefs]);

  return ref;
}
