# Solana Risk Scanner FINAL
Questa versione non usa `getProgramAccounts`, che alcuni RPC pubblici trattano come richiesta indicizzata/pesante.
Usa invece `getAccountInfo`, `getTokenSupply` e `getTokenLargestAccounts`, con fallback automatico tra più RPC pubblici.
Il frontend è pronto per GitHub Pages e non richiede una API key.
Per uso continuativo/produzione è consigliato un RPC dedicato: gli endpoint pubblici Solana sono soggetti a rate limit e possono bloccare traffico. 
