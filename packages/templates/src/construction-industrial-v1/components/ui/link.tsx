import React from 'react';

export function Link({
  href,
  children,
  className,
  target,
  rel,
  onClick,
  ...rest
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children?: React.ReactNode }) {
  return (
    <a href={href} className={className} target={target} rel={rel} onClick={onClick} {...rest}>
      {children}
    </a>
  );
}
