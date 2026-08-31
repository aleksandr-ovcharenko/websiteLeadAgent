import { useEffect, useState } from 'react';

export function usePathname(): string {
  const [pathname, setPathname] = useState(() =>
    typeof window !== 'undefined' ? window.location.pathname : '/'
  );

  useEffect(() => {
    const update = () => setPathname(window.location.pathname);
    window.addEventListener('popstate', update);
    window.addEventListener('pushstate', update);
    return () => {
      window.removeEventListener('popstate', update);
      window.removeEventListener('pushstate', update);
    };
  }, []);

  return pathname;
}
