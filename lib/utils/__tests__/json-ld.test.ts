import { describe, expect, it } from 'vitest';
import { serializeJsonLd } from '../json-ld';

describe('serializeJsonLd', () => {
  it('cannot terminate a script element or inject HTML from profile values', () => {
    const profile = {
      name: '</script><img src=x onerror=alert(1)>',
      description: '<!-- & > \u2028 \u2029',
    };
    const serialized = serializeJsonLd(profile);
    const container = document.createElement('div');
    container.innerHTML = `<script type="application/ld+json">${serialized}</script>`;
    expect(container.children).toHaveLength(1);
    expect(container.querySelector('img')).toBeNull();
    expect(serialized).not.toMatch(/[<>&\u2028\u2029]/u);
    expect(JSON.parse(container.firstElementChild!.textContent!)).toEqual(profile);
  });

  it('preserves ordinary medical metadata and Unicode', () => {
    const profile = { '@type': 'MedicalBusiness', name: 'Dr Élodie', address: { streetAddress: 'Tunis' } };
    expect(JSON.parse(serializeJsonLd(profile))).toEqual(profile);
  });
});
