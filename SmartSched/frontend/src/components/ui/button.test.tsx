import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Link } from 'react-router-dom';
import { Button } from './index';

describe('Button component', () => {
  it('renders a single child safely when asChild is true', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <Button asChild size="sm">
          <Link to="/timetable">Open Timetable</Link>
        </Button>
      </MemoryRouter>
    );
    expect(html).toContain('href="/timetable"');
    expect(html).toContain('Open Timetable');
  });

  it('renders loading spinner when loading is true without asChild', () => {
    const html = renderToStaticMarkup(<Button loading>Generating</Button>);
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('Generating');
  });
});
