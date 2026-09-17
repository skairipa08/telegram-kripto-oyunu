import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AnimatedCounter } from './animated-counter';
import { GameLayout } from '../game/game-layout';

describe('AnimatedCounter Component', () => {
  it('renders formatted number correctly in static/SSR mode', () => {
    const html = renderToStaticMarkup(
      <AnimatedCounter value={1250} compact={false} />,
    );
    expect(html).toContain('class="animated-counter-root"');
    expect(html).toContain('class="counter-digits"');
    expect(html).toContain('1.250');
  });

  it('renders compact notation numbers', () => {
    const html = renderToStaticMarkup(
      <AnimatedCounter value={1500000} compact={true} />,
    );
    expect(html).toContain('1.5M');
  });

  it('handles null values gracefully', () => {
    const html = renderToStaticMarkup(<AnimatedCounter value={null} />);
    expect(html).toContain('—');
  });

  it('renders custom className and aria-label', () => {
    const html = renderToStaticMarkup(
      <AnimatedCounter
        value={100}
        className="custom-badge"
        ariaLabel="Total balance"
      />,
    );
    expect(html).toContain('custom-badge');
    expect(html).toContain('aria-label="Total balance"');
  });
});

describe('GameLayout Stream 1 Enhancements', () => {
  it('renders animated counters for cash and points in wallet-strip', () => {
    const html = renderToStaticMarkup(
      <GameLayout
        tab="empire"
        onTab={() => undefined}
        name="Tester"
        cash={2500}
        points={450}
      >
        <div>Content</div>
      </GameLayout>,
    );

    expect(html).toContain('class="wallet-strip"');
    expect(html).toContain('class="wallet-pill wallet-cash"');
    expect(html).toContain('class="wallet-pill wallet-points"');
    expect(html).toContain('2.5K');
    expect(html).toContain('450');
  });

  it('renders total empire level badge in wallet-strip when level prop is provided', () => {
    const html = renderToStaticMarkup(
      <GameLayout
        tab="empire"
        onTab={() => undefined}
        name="Tester"
        cash={2500}
        points={450}
        level={8}
      >
        <div>Content</div>
      </GameLayout>,
    );

    expect(html).toContain('class="wallet-pill wallet-level-badge"');
    expect(html).toContain('Lv.8');
    expect(html).toContain('Seviye');
  });

  it('derives total empire level badge when level prop is omitted but player has points/cash', () => {
    const html = renderToStaticMarkup(
      <GameLayout
        tab="empire"
        onTab={() => undefined}
        name="Tester"
        cash={1000}
        points={250}
      >
        <div>Content</div>
      </GameLayout>,
    );

    expect(html).toContain('class="wallet-pill wallet-level-badge"');
    expect(html).toContain('Lv.3');
  });

  it('wraps screen content in screen-transition-pane for zero-CLS GPU transitions', () => {
    const html = renderToStaticMarkup(
      <GameLayout
        tab="missions"
        onTab={() => undefined}
        name="Tester"
        cash={1000}
        points={100}
      >
        <div id="missions-test-screen">Missions Body</div>
      </GameLayout>,
    );

    expect(html).toContain('class="screen-transition-pane"');
    expect(html).toContain('id="missions-test-screen"');
  });

  it('renders active tab with halo and under-bar indicators on mobile navigation', () => {
    const html = renderToStaticMarkup(
      <GameLayout
        tab="friends"
        onTab={() => undefined}
        name="Tester"
        cash={1000}
        points={100}
      >
        <div>Friends Tab</div>
      </GameLayout>,
    );

    expect(html).toContain('class="mobile-nav-item active"');
    expect(html).toContain('class="nav-halo"');
    expect(html).toContain('class="nav-underbar"');
  });
});
