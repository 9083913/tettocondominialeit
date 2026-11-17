# SEO/GEO generator

Rigenera tutto: `python3 home.py <condo|privati> && python3 build.py <condo|privati>` (home parte da `orig/*.html`).
- `cities.json`: dataset città (20). Per aggiungerne: nuova riga con slug, name, prov, region, cap (5 cifre), zona (A–F), edilizia, logistica, clima, casa, nota. Il coefficiente regionale deriva dalla prima cifra del CAP.
- `content_condo.py` / `content_privati.py`: servizi, guide, testi home. `lib.py`: modello prezzi (verificato identico a `TC.estimate` del calcolatore), layout, JSON-LD.
- `verify.py`: JSON-LD, link interni, canonical, H1, similarità. Poi deploy: `wrangler pages deploy public`.
