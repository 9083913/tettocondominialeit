# Design system v1 — TettoCondominiale / PreventivoTetto
Unica fonte: blocco `/* ===== DESIGN SYSTEM v1 */` in `public/index.html` (variabili CSS `:root`). Le pagine legali hanno lo stesso set ridotto.

## Token
- **Font**: Plus Jakarta Sans (400/600/700/800), un'unica famiglia.
- **Testo**: xs 13 · sm 14 · md 16 · lg 20 · xl 28 · 2xl fluido 30→52 (solo H1). Corpo mai sotto 13; campi input 16 (no zoom iOS).
- **Spazio** (multipli di 4): 4, 8, 12, 16, 20, 24, 32, 48.
- **Raggi**: sm 10 (pulsanti, campi, card piccole) · md 14 (opzioni, card) · lg 20 (card hero, modali) · full 999 (badge).
- **Ombre**: sh-1 sottile · sh-2 sollevata · sh-3 card hero/modali.
- **Colori**: navy `#12304A` (testo, sfondi scuri) · arancio `#E8703A` / hover `#D9622E` (unica azione primaria) · grigio-blu `#40556A` (testo secondario) · `#55687A` (muto) · bordo `#DCE3E9` · fondo `#EEF1F4` · errore `#B3261E` · successo `#1E6B45`.
- **Tocco**: altezza minima 48px (`--tap`); mai sotto 44.

## Componenti
- **Pulsante primario** `.btn` (arancio, 48px; `.btn-lg` 56px). Secondario `.btn-o`. Disabilitato grigio. Focus: anello arancio 3px.
- **Campo** `.inp` 48-54px, bordo 2px, errore `.bad` + testo `.errt`.
- **Opzione quiz** `.opt` (radio/checkbox) 56-60px, selezionata = bordo arancio + fondo tenue.
- **Card** `.card` (hero), `.fat` (fattori), `.adm` (amministratori). **Accordion** `.faq details`.
- **Modali** (`.modal`, `#pp-m`, `dialog.legal-dlg`): PC centrati; smartphone foglio dal basso con pulsante di invio fisso.
- **Cookie banner** compatto in basso, 3 pulsanti da 44px.
## Regole
1. Una sola azione primaria arancio per schermata; il resto navy/bianco.
2. Nessun valore fuori scala: usa solo i token. Nuovi colori = nuovo token qui.
3. Smartphone: zero scroll orizzontale, tocchi ≥44px, carosello a scatto per liste di card.
4. Testi brevi: una riga dove possibile; niente frasi che ripetono il titolo.
5. Nuove pagine: copia il blocco `LEGAL_CSS` di `tooling/redesign.py`.
