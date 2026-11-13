# Haikai Machine

> A máquina fotográfica de texto. Quem tira foto *fotografa*; quem faz haikai *haikaliza*.

Progressive Web App (PWA) mobile-first em HTML5, CSS3 e Vanilla JavaScript, sem bibliotecas nem frameworks. Registre cenas e instantes observados ao sair de casa, cada um com **data/hora exatas** e **localização real**.

- App: https://magpe-stack.github.io/HaikaiMachine/
- Código: https://github.com/magpe-stack/HaikaiMachine

## Arquivos

| Arquivo | Função |
|---|---|
| `index.html` | Estrutura, splash, header, menu lateral, rodapé, diálogos e sprite de ícones SVG |
| `style.css` | Design system (tokens WCAG), layout responsivo, splash, impressão (`@media print`) |
| `app.js` | Toda a lógica: rotas, acervos, haikalizar, geolocalização, ações, backup, teoria, PWA |
| `manifest.json` | Manifesto PWA (usa `icon-192.png` e `icon-512.png`) |
| `sw.js` | Service Worker (cache offline) |
| `teoria-haikai.json` | Conteúdo da seção Teoria (5 pastas), carregado dinamicamente |
| `icon-192.png`, `icon-512.png` | Ícones do PWA. **Já existem na raiz do repositório; não estão neste zip.** |

## Publicar no GitHub Pages

1. Coloque todos os arquivos na raiz do repositório (junto com `icon-192.png` e `icon-512.png`).
2. Em *Settings → Pages*, escolha a branch `main` e a pasta `/ (root)`.
3. Acesse `https://magpe-stack.github.io/HaikaiMachine/`.

O app exige **HTTPS** (ou `localhost`) para Geolocalização, Service Worker, Clipboard e instalação. Para testar localmente: `python3 -m http.server 8080` e abra `http://localhost:8080`.

## Como usar

1. **Novo Acervo**: nomeie o passeio (até 50 caracteres, com contador).
2. **Iniciar**: registra o stamp de data/hora de início.
3. **Haikalizar**: três versos (até 40 caracteres cada) com assistente de sílabas 5-7-5, que informa sem bloquear.
4. **Revelar haikai**: o app anexa data/hora exatas (`Intl.DateTimeFormat`) e a localização (`navigator.geolocation.getCurrentPosition`).
5. Em cada haikai: **Copiar**, **Compartilhar**, **Imprimir**, **Excluir**. No acervo: copiar/compartilhar/imprimir tudo.

## APIs nativas utilizadas

| Recurso | API |
|---|---|
| Localização | Geolocation API (com tratamento de permissão negada, indisponível e tempo esgotado) |
| Copiar | `navigator.clipboard.writeText` (fallback `execCommand`) |
| Compartilhar | `navigator.share`; sem suporte, abre diálogo com WhatsApp, e-mail e copiar |
| Imprimir | `window.print()` + CSS `@media print` + `afterprint` |
| Tela cheia | `document.documentElement.requestFullscreen()` |
| Instalação | `beforeinstallprompt` + `prompt()` |
| Offline | Service Worker + Cache Storage |
| Dados | `localStorage` (+ `navigator.storage.persist()`) |
| Backup | `Blob` + `URL.createObjectURL` / `File.text()` |

### Endereço por referência

Além das coordenadas, o app tenta obter um endereço de referência chamando, via `fetch`, o serviço público **OpenStreetMap Nominatim**. Não existe API nativa de geocodificação reversa no Chrome. A chamada é feita em segundo plano, com limite de 7 s; se falhar ou estiver offline, o haikai mantém as coordenadas e o link para o mapa. Se preferir não enviar coordenadas a terceiros, remova a chamada a `enderecoReverso` em `app.js`.

## Backup geral

*Menu → Backup Geral* baixa um `.json` com todos os acervos, haikais, timestamps, geolocalizações e configurações (tema):

```json
{
  "app": "Haikai Machine",
  "versao": 1,
  "exportadoEm": "2026-11-12T21:00:00.000Z",
  "configuracoes": { "tema": "light" },
  "acervos": [
    {
      "id": "…", "nome": "…", "criadoEm": "…", "inicio": "…", "fim": null,
      "haikais": [
        { "id": "…", "versos": ["…", "…", "…"], "dataHora": "…",
          "local": { "status": "ok", "lat": 0, "lon": 0, "precisao": 12, "endereco": "…" } }
      ]
    }
  ]
}
```

*Importar Backup* valida e sanitiza o arquivo e pergunta se deve **mesclar** com os dados atuais ou **substituir** tudo.

## Contador de sílabas poéticas

`contarSilabasPoeticas()` em `app.js` aplica a escanção do português: separação silábica (ditongos, hiatos, dígrafos, encontros consonantais), identificação da sílaba tônica, **sinalefa** entre palavras e contagem **até a última sílaba tônica**. É uma estimativa por regras: casos ambíguos (diérese/sinérese, palavras com tonicidade irregular sem acento) podem divergir da leitura do poeta. Por isso o contador apenas informa e nunca bloqueia.

## Acessibilidade (WCAG 2.1)

- Tokens de cor com contraste AA/AAA nos temas claro (padrão) e escuro, preferência salva.
- Navegação por teclado completa, foco visível, *skip link*, menu lateral com foco preso e `Esc` para fechar.
- Diálogos nativos `<dialog>`, regiões `aria-live` para contadores e estados, alvos de toque de pelo menos 44 px.
- `prefers-reduced-motion` respeitado na splash e no menu.

## Limitações conhecidas

- Os dados ficam no `localStorage` do navegador: limpar os dados do site apaga os acervos. Faça backups.
- `navigator.share` depende do sistema (comum em Chrome Android; em desktop, depende do SO). Há fallback.
- O Chrome só mostra o prompt de instalação quando seus critérios de PWA são atendidos; caso contrário, use o menu ⋮ do Chrome.
