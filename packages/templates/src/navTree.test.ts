// V3.7.8 — nested navigation tree contract.
//
// The visual header renders the NAV tree hierarchically (up to 3 levels) —
// never flattened. Unroutable targets produce no link; a parent whose
// children are all unroutable but which has its own href stays a link.
import { describe, it, expect } from 'vitest';
import { headerNavTree, flattenNavLeaves } from './nav.js';

const item = (id: string, over: any = {}): any => ({
  id, label: id, href: `/${id}`, sortOrder: 0,
  showInHeader: true, showInFooter: true, showOnHomepage: true,
  ...over,
});

describe('headerNavTree', () => {
  it('preserves up to three levels of hierarchy', () => {
    const tree = headerNavTree([
      item('services', { children: [
        item('design', { children: [item('kvartiry'), item('doma')] }),
        item('remont'),
      ]}),
      item('contacts'),
    ]);
    expect(tree).toHaveLength(2);
    expect(tree[0].children).toHaveLength(2);
    expect(tree[0].children![0].children).toHaveLength(2);
    expect(tree[1].children).toBeUndefined();
  });

  it('drops items with unroutable targets — no dead "#" links', () => {
    const tree = headerNavTree([
      item('dead', { href: '#' }),
      item('also-dead', { href: '' }),
      item('live', { href: '/live' }),
    ]);
    expect(tree.map((n) => n.id)).toEqual(['live']);
  });

  it('a parent with unroutable href but routable children renders as a submenu group', () => {
    const tree = headerNavTree([
      item('group', { href: '#', children: [item('child', { href: '/child' })] }),
    ]);
    expect(tree).toHaveLength(1);
    expect(tree[0].href).toBe('');      // no link, but children survive
    expect(tree[0].children![0].href).toBe('/child');
  });

  it('a parent with a valid href AND children keeps both', () => {
    const tree = headerNavTree([item('services', { href: '/services', children: [item('a', { href: '/a' })] })]);
    expect(tree[0].href).toBe('/services');
    expect(tree[0].children).toHaveLength(1);
  });

  it('a parent whose children are ALL unroutable and has no href is dropped entirely', () => {
    const tree = headerNavTree([item('group', { href: '', children: [item('x', { href: '#' })] })]);
    expect(tree).toHaveLength(0);
  });

  it('children keep their order and showInHeader filtering applies recursively', () => {
    const tree = headerNavTree([
      item('p', { href: '/p', children: [
        item('vis', { href: '/vis', sortOrder: 1 }),
        item('hid', { href: '/hid', showInHeader: false, sortOrder: 0 }),
      ]}),
    ]);
    expect(tree[0].children!.map((c: any) => c.id)).toEqual(['vis']);
  });

  it('external targets keep their absolute href', () => {
    const tree = headerNavTree([item('ext', { href: 'https://example.com/x', external: true })]);
    expect(tree[0].href).toBe('https://example.com/x');
    expect(tree[0].external).toBe(true);
  });
});

describe('flattenNavLeaves — footer keeps the flat projection', () => {
  it('flattens the tree to leaf-first order for footer links', () => {
    const leaves = flattenNavLeaves([
      item('a', { children: [item('a1', { href: '/a1' })] }),
      item('b', { href: '/b' }),
    ]);
    expect(leaves.map((n) => n.id)).toEqual(['a', 'a1', 'b']);
  });
});
