# Inventario — tettocondominiale.it (e gemello preventivotetto.it)
Stack: HTML/CSS/JS statico in `public/index.html` (Cloudflare Pages + Functions + D1). Due siti identici salvo brand/analytics.
**Scopo**: lead generation preventivi rifacimento tetto condominiale. **3 azioni chiave**: 1) avviare il calcolatore, 2) vedere la stima, 3) lasciare i contatti (gate).
## Schermate e stati
- Home: hero+quiz (7 passi: intervento, mq/ignoto, appartamenti, anno, stato (multi), ruolo, CAP+suggerimenti) → passo 8 stima+form contatti (errori, invio, successo, errore invio, ripristino sessione)
- Sezioni: Come funziona, Fattori di costo, Per amministratori, Casi (nascosta), FAQ (8), Lavora con noi → modale candidatura impresa
- Overlay: banner cookie (+personalizza), modale exit-intent, dialog legale (privacy/cookie/condizioni), sticky CTA mobile
- Pagine: privacy, cookie-policy, condizioni-servizio, collega-zoho(+completato) [tecniche]
