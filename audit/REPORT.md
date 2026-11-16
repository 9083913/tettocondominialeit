# Report redesign (branch redesign-ui) — tettocondominiale.it e preventivotetto.it
Screenshot: `audit/prima/` e `audit/dopo/` (stesso nome file = stesso stato; es. `home-fold_d1440.png`, `home-full_m390.png`, `quiz-step7_m390.png`, `partner-modal_m390.png`).
Script riproducibile: `tooling/capture.mjs` (7 viewport, quiz completo, modali, pagine legali, misure).

| Misura | Prima | Dopo |
|---|---|---|
|Scroll orizzontale (tutte le viste)|0|0|
|Errori console|0|0|
|Altezza home PC 1440|4096 px|3149 px (−23%)|
|Altezza home smartphone 390|5705 px|4052 px (−29%)|
|Target <44px, hero smartphone|4|0|
|Target <44px, modale uscita smartphone|13|3 (solo checkbox 22px dentro etichetta da 44)|
|Raggi diversi in uso|9|6 (restano quelli di contenuti legacy: cookie/legal)|
|Dimensioni di testo diverse (home PC)|16|12|

## Problemi e correzioni per pagina
- **Home / hero**: "tettodel", "secondi.Poi" (spazio mancante) → corretto; sottotitolo tagliato su mobile → corretto; "Passo 1 di 7" centrato per elemento invisibile → corretto; hero più compatta (contenuto parte 40px più in alto su PC); testo e card centrati sulla stessa riga.
- **Quiz e stima**: campi a 16px, intestazione 48px, opzioni 56-60px; logica invariata (invio lead provato con API simulata: OK su entrambi i siti).
- **Sezioni**: spaziature −30%, testi accorciati, CTA duplicate rimosse (resta quella nel riquadro fattori, nel FAQ e la barra fissa mobile), fattori di costo in carosello a scatto su smartphone, passi in righe compatte.
- **Imprese partner**: colori fuori sistema (blu #1744c8, gradiente) → navy/arancio; modale a foglio dal basso su smartphone, pulsante invio fisso; riquadro allineato alla griglia.
- **Pagine legali**: font Inter → Plus Jakarta Sans, card centrata, 16px, pulsante ritorno 48px.
- **Cookie**: compatto, tocchi 44px.
## Limiti noti
- Non toccati: testi legali nel dialog, pagine `collega-zoho*`, kanban/dashboard (non esistono).
- Il backend lead (`/api/lead`) non è raggiungibile in locale: provato solo con risposta simulata.
- Console: nessun errore, ma Yandex/GA sono caricati solo dopo consenso e non testati.
