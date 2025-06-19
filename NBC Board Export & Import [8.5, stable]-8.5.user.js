// ==UserScript==
// @name         NBC Board Export & Import [8.7, stable]
// @namespace    https://niedersachsen.cloud/
// @version      8.7
// @description  Export/Import mit vollständiger Elementstruktur-Erhaltung. Unterstützt Lichtblick- und Bettermarks-Tools mit verbesserter ID-Erkennung.
// @author       Johannes Felbermair, ChatGPT
// @match        https://niedersachsen.cloud/boards/*
// @grant        GM_xmlhttpRequest
// @connect      niedersachsen.cloud
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    // --- Erweiterte Konfiguration ---
    const CONFIG = {
        TIMING: {
            CLICK_DELAY: 3000,
            FIELD_DELAY: 1000,
            ACTION_DELAY: 1200,
            COLUMN_CREATION_DELAY: 2500,
            COLUMN_STABILIZATION_DELAY: 2000,
            BUTTON_SEARCH_DELAY: 1000,
            ELEMENT_CREATION_DELAY: 2000,
            ELEMENT_SELECTION_DELAY: 2500,
            ELEMENT_CONTENT_DELAY: 1000,
            UI_STABILIZATION_DELAY: 1500,
            LINK_INPUT_DELAY: 1000,
            BOLD_FORMATTING_DELAY: 500,
            EXTERNAL_TOOL_DELAY: 1500,
            EXTERNAL_TOOL_SEARCH_DELAY: 1000,
            DROPDOWN_WAIT_DELAY: 800
        },
        DEBUG: true,
        ELEMENT_TYPES: {
            TEXT: 'text',
            FILE: 'file',
            DRAWING: 'drawing',
            COLLAB_EDITOR: 'collaborative-editor',
            LINK: 'link',
            VIDEO_CONFERENCE: 'video-conference',
            EXTERNAL_TOOL: 'external-tool'
        }
    };

    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

    function log(...args) {
        if (CONFIG.DEBUG) console.log('[NBC 8.7]', ...args);
    }

    function notify(msg, type = 'info') {
        let el = document.getElementById('tm-status');
        if (!el) {
            el = document.createElement('div');
            el.id = 'tm-status';
            Object.assign(el.style, {
                position: 'fixed',
                top: '20px',
                right: '20px',
                padding: '6px 12px',
                background: type === 'error' ? '#f44336' : type === 'success' ? '#4caf50' : '#2196f3',
                color: '#fff',
                borderRadius: '4px',
                zIndex: 2147483647
            });
            document.body.appendChild(el);
        }
        el.textContent = msg;
    }

    // --- KORRIGIERTE Externe Tool URL-Extraktion basierend auf Netzwerkaufzeichnung ---
    async function extractExternalToolId(contextId) {
        return new Promise((resolve) => {
            const launchEndpoint = `https://niedersachsen.cloud/api/v3/tools/context/${contextId}/launch`;

            log(`Versuche Tool-ID zu extrahieren für Context: ${contextId}`);
            log(`Launch-Endpoint: ${launchEndpoint}`);

            GM_xmlhttpRequest({
                method: 'GET',
                url: launchEndpoint,
                headers: {
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache',
                    'If-None-Match': ''
                },
                onload: (response) => {
                    try {
                        log(`Launch-Endpoint Response Status: ${response.status}`);
                        log(`Launch-Endpoint Response Text: ${response.responseText}`);

                        // Behandlung von 304-Status (Not Modified) - KORRIGIERT basierend auf Netzwerkaufzeichnung
                        if (response.status === 304) {
                            log('304 (Not Modified) - verwende zwischengespeicherte Daten');

                            // Parse den Response Text direkt (enthält den JSON-Content trotz 304)
                            const data = JSON.parse(response.responseText);
                            if (data.url) {
                                const url = data.url;
                                log(`Erhaltene Launch-URL aus 304-Cache: ${url}`);
                                const toolId = extractIdFromUrl(url);
                                resolve(toolId);
                                return;
                            }
                        }

                        // Behandlung von 200-Status
                        if (response.status === 200) {
                            const data = JSON.parse(response.responseText);
                            if (data.url) {
                                log(`Erhaltene Launch-URL: ${data.url}`);
                                const toolId = extractIdFromUrl(data.url);
                                resolve(toolId);
                                return;
                            }
                        }

                        log(`Unbekannter Statuscode: ${response.status}`);
                        resolve('UnknownStatus');

                    } catch (e) {
                        log('Fehler beim Parsen des Launch-JSON:', e);
                        log('Response Text war:', response.responseText);
                        resolve('JsonParseError');
                    }
                },
                onerror: (err) => {
                    log('Fehler beim Abruf des Launch-Endpoints:', err);
                    resolve('NetworkError');
                }
            });
        });
    }

    // Extrahiert ID aus Lichtblick-URL (basierend auf Netzwerkaufzeichnung)
    function extractIdFromUrl(url) {
        log(`Extrahiere ID aus URL: ${url}`);

        // KORRIGIERT: Lichtblick-spezifische Extraktion basierend auf Netzwerkaufzeichnung
        if (url.includes('lichtblick.moin-schule.nwdl.eu')) {
            log('Lichtblick-URL erkannt, verwende spezielle ID-Extraktion...');

            // Methode 1: URL-Parameter 'id' extrahieren
            try {
                const urlObj = new URL(url);
                const idParam = urlObj.searchParams.get('id');
                if (idParam && idParam.length > 0) {
                    log(`Tool-ID über URL-Parameter 'id': ${idParam}`);
                    return idParam;
                }
            } catch (e) {
                log('Fehler beim Parsen der URL mit URL-Objekt:', e);
            }

            // Methode 2: Regex für ?id=X1Y3Z3W Pattern
            const idMatch = url.match(/[?&]id=([^&#]+)/);
            if (idMatch && idMatch[1]) {
                log(`Tool-ID über Regex-Pattern ?id=: ${idMatch[1]}`);
                return idMatch[1];
            }

            // Methode 3: Fallback für Lichtblick - alles nach ?id=
            const idIndex = url.indexOf('?id=');
            if (idIndex !== -1) {
                const afterId = url.substring(idIndex + 4);
                const hashIndex = afterId.indexOf('#');
                const ampIndex = afterId.indexOf('&');

                let endIndex = afterId.length;
                if (hashIndex !== -1) endIndex = Math.min(endIndex, hashIndex);
                if (ampIndex !== -1) endIndex = Math.min(endIndex, ampIndex);

                const toolId = afterId.substring(0, endIndex);
                if (toolId.length > 0) {
                    log(`Tool-ID über Fallback-Extraktion: ${toolId}`);
                    return toolId;
                }
            }
        }

        // Allgemeine Methoden für andere Tools
        try {
            const urlObj = new URL(url);
            const params = urlObj.searchParams;

            const possibleParams = ['id', 'tool_id', 'toolId', 'sequence_id', 'sequenceId'];
            for (const param of possibleParams) {
                if (params.has(param)) {
                    const toolId = params.get(param);
                    log(`Tool-ID über URL-Parameter '${param}': ${toolId}`);
                    return toolId;
                }
            }
        } catch (e) {
            log('Fehler beim allgemeinen URL-Parameter-Parsing:', e);
        }

        // Letztes URL-Segment (alter Fallback)
        const urlParts = url.split('/');
        const lastSegment = urlParts[urlParts.length - 1];
        if (lastSegment && lastSegment.length > 3 && !lastSegment.includes('?')) {
            log(`Tool-ID über letztes URL-Segment: ${lastSegment}`);
            return lastSegment;
        }

        log('Keine ID in URL gefunden');
        return 'NoIdFound';
    }

    // Kontext-ID eines externen Tools über die Karten-API ermitteln
    async function fetchContextIdFromApi(cardId, elementId) {
        return new Promise((resolve) => {
            if (!cardId || !elementId) {
                resolve('');
                return;
            }
            const apiUrl = `https://niedersachsen.cloud/api/v3/cards?ids=${cardId}`;
            log(`Rufe Karten-API auf: ${apiUrl}`);
            GM_xmlhttpRequest({
                method: 'GET',
                url: apiUrl,
                headers: {
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache',
                    'If-None-Match': ''
                },
                onload: (response) => {
                    try {
                        log(`Cards-API Status: ${response.status}`);
                        if (response.status === 200 || response.status === 304) {
                            const data = JSON.parse(response.responseText);
                            const cardData = (data.data && data.data[0]) || data;
                            const el = (cardData.elements || []).find(e => e.id === elementId);
                            if (el && el.content && el.content.contextExternalToolId) {
                                const ctxId = el.content.contextExternalToolId;
                                log(`Kontext-ID aus API: ${ctxId}`);
                                resolve(ctxId);
                                return;
                            }
                        }
                        log('Keine Kontext-ID in Karten-API gefunden');
                        resolve('');
                    } catch (e) {
                        log('Fehler beim Parsen der Cards-API:', e);
                        resolve('');
                    }
                },
                onerror: (err) => {
                    log('Fehler beim Abrufen der Karten-API:', err);
                    resolve('');
                }
            });
        });
    }

    // --- DEBUG-Funktionen ---
    function debugColumnStructure() {
        const columns = document.querySelectorAll('[data-testid^="board-column-"]');
        log('=== NBC Column Debug ===');
        log(`Gefundene Spalten: ${columns.length}`);
        columns.forEach((col, idx) => {
            const buttons = col.querySelectorAll('button');
            log(`Spalte ${idx}:`, {
                testid: col.getAttribute('data-testid'),
                buttons: buttons.length,
                buttonTexts: Array.from(buttons).map(b => b.textContent.trim()).filter(t => t)
            });
        });
    }

    // --- ERWEITERTE Element-Analysefunktion ---
    function analyzeCardElements(card) {
        const elements = [];
        const contentElements = card.querySelectorAll('[data-testid^="board-contentelement-"]');
        const cardTestId = card.getAttribute('data-testid') || '';
        const cardIdMatch = cardTestId.match(/board-card-(.+)/);
        const cardId = cardIdMatch ? cardIdMatch[1] : (card.getAttribute('id') || '');
        log(`Analysiere ${contentElements.length} Elemente in Karte (ID: ${cardId})`);

        contentElements.forEach((contentElement, index) => {
            const elementData = {
                order: index,
                type: 'unknown'
            };

            // Text-Element erkennen
            const ckContent = contentElement.querySelector('.ck-content');
            if (ckContent) {
                elementData.type = CONFIG.ELEMENT_TYPES.TEXT;
                if (ckContent.ckeditorInstance && typeof ckContent.ckeditorInstance.getData === 'function') {
                    elementData.content = ckContent.ckeditorInstance.getData();
                    log(`Element ${index}: Text-Element mit CKEditor API erkannt`);
                } else if (ckContent.innerHTML) {
                    elementData.content = ckContent.innerHTML.trim();
                    log(`Element ${index}: Text-Element mit innerHTML-Fallback erkannt`);
                }
            }

            // Datei-Element erkennung
            const fileElement = contentElement.querySelector('[data-testid="board-file-element"]');
            if (fileElement) {
                elementData.type = CONFIG.ELEMENT_TYPES.FILE;
                let fileName = 'Unbekannte Datei';

                const titleElement = fileElement.querySelector('.v-card-title, .file-name, .filename, [data-testid*="file-name"]');
                if (titleElement && titleElement.textContent.trim()) {
                    fileName = titleElement.textContent.trim();
                } else {
                    const textContent = fileElement.textContent.trim();
                    if (textContent) {
                        const fileNameMatch = textContent.match(/[^\/\\]+\.[a-zA-Z0-9]+/);
                        if (fileNameMatch) {
                            fileName = fileNameMatch[0];
                        } else if (textContent.length < 100) {
                            fileName = textContent;
                        }
                    }
                }

                if (fileName === 'Unbekannte Datei') {
                    const link = fileElement.querySelector('a[href], [href]');
                    if (link && link.href) {
                        const urlPath = link.href.split('/').pop();
                        if (urlPath && urlPath.includes('.')) {
                            fileName = decodeURIComponent(urlPath);
                        }
                    }
                }

                if (fileName === 'Unbekannte Datei') {
                    fileName = `Datei_${index + 1}`;
                }

                let fileInfo = '';
                const fileInfoElement = fileElement.querySelector('.text-caption');
                if (fileInfoElement && fileInfoElement.textContent.trim()) {
                    fileInfo = fileInfoElement.textContent.trim();
                    log(`Element ${index}: Datei-Info gefunden: ${fileInfo}`);
                } else {
                    fileInfo = 'Unbekanntes Format';
                }

                elementData.fileName = fileName;
                elementData.fileInfo = fileInfo;
                elementData.content = `📎 Datei-Platzhalter: ${fileName}, ${fileInfo}`;
                elementData.shouldBeBold = true;
                log(`Element ${index}: Datei-Element erkannt: ${fileName} (${fileInfo})`);
            }

            // Whiteboard-Element erkennen
            const drawingElement = contentElement.querySelector('[data-testid="drawing-element"]');
            if (drawingElement) {
                elementData.type = CONFIG.ELEMENT_TYPES.DRAWING;
                const title = drawingElement.querySelector('.content-element-title')?.textContent.trim() || 'Whiteboard';
                elementData.title = title;
                elementData.content = `🖌️ Whiteboard: ${title}`;
                elementData.shouldBeBold = true;
                log(`Element ${index}: Whiteboard-Element erkannt: ${title}`);
            }

            // Kollaborativer Editor (Etherpad)
            const collabEditor = contentElement.querySelector('[data-testid="collaborative-text-editor-element"]');
            if (collabEditor) {
                elementData.type = CONFIG.ELEMENT_TYPES.COLLAB_EDITOR;
                const title = collabEditor.querySelector('.content-element-title')?.textContent.trim() || 'Etherpad';
                elementData.title = title;
                elementData.content = `✏️ Etherpad: ${title}`;
                elementData.shouldBeBold = true;
                log(`Element ${index}: Kollaborativer Editor erkannt: ${title}`);
            }

            // Videokonferenz-Element erkennen
            const videoConferenceElement = contentElement.querySelector('[data-testid="video-conference-element"]');
            if (videoConferenceElement) {
                elementData.type = CONFIG.ELEMENT_TYPES.VIDEO_CONFERENCE;
                const title = videoConferenceElement.querySelector('[data-testid="content-element-title-slot"]')?.textContent.trim() || 'Videokonferenz';
                elementData.title = title;
                elementData.content = `📹 Videokonferenz: ${title}`;
                elementData.shouldBeBold = true;
                log(`Element ${index}: Videokonferenz-Element erkannt: ${title}`);
            }

            // Link-Element erkennen
            const linkElement = contentElement.querySelector('[data-testid="board-link-element"]');
            if (linkElement) {
                elementData.type = CONFIG.ELEMENT_TYPES.LINK;
                const titleElement = linkElement.querySelector('[data-testid="content-element-title-slot"]');
                const title = titleElement?.textContent.trim() || 'Link';

                let url = '';
                const px4Elements = linkElement.querySelectorAll('.px-4');
                if (px4Elements.length > 0) {
                    for (const px4Element of px4Elements) {
                        const text = px4Element.textContent.trim();
                        if (text !== title && (text.includes('.') || text.includes('http') || text.includes('www') || text.includes('/'))) {
                            url = text;
                            break;
                        }
                    }

                    if (!url && px4Elements.length > 1) {
                        url = px4Elements[px4Elements.length - 1].textContent.trim();
                    } else if (!url && px4Elements.length === 1) {
                        const singleText = px4Elements[0].textContent.trim();
                        if (singleText !== title) {
                            url = singleText;
                        }
                    }
                }

                if (!url) {
                    const barTexts = linkElement.querySelector('.content-element-bar-texts');
                    if (barTexts) {
                        const px4InBar = barTexts.querySelectorAll('.px-4');
                        for (const px4Element of px4InBar) {
                            const text = px4Element.textContent.trim();
                            if (text !== title) {
                                url = text;
                                break;
                            }
                        }
                    }
                }

                if (!url) {
                    url = 'URL nicht gefunden';
                }

                elementData.title = title;
                elementData.url = url;
                elementData.content = `🔗 Link: ${title} (${url})`;
                elementData.shouldBeBold = true;
                log(`Element ${index}: Link-Element erkannt: ${title} -> ${url}`);
            }

            // VERBESSERTE Externes Tool-Element Erkennung
            const externalToolElement = contentElement.querySelector('[data-testid^="board-external-tool-element-"]');
            if (externalToolElement) {
                elementData.type = CONFIG.ELEMENT_TYPES.EXTERNAL_TOOL;

                const testId = externalToolElement.getAttribute('data-testid') || '';
                const toolNameMatch = testId.match(/board-external-tool-element-(.+)/);
                const toolName = toolNameMatch ? toolNameMatch[1] : 'UnknownTool';

                const titleElement = externalToolElement.querySelector('[data-testid="content-element-title-slot"]');
                const displayName = titleElement?.textContent.trim() || toolName;

                // Tool-Typ anhand des Logos bestimmen
                let toolType = '';
                const logoImg = externalToolElement.querySelector('img[src*="external-tools"]');
                if (logoImg) {
                    const src = logoImg.getAttribute('src') || '';
                    if (src.includes('656e06272113d049ac0611b0')) {
                        toolType = 'Lichtblick';
                    } else if (src.includes('651d3288054b8000e321532e')) {
                        toolType = 'Bettermarks';
                    }
                }

                // VERBESSERTE Context-ID Extraktion basierend auf Netzwerkaufzeichnung
                let contextId = '';

                // Methode 1: id-Attribut (6853d144d542b1f8e8e6930e aus Netzwerkaufzeichnung)
                contextId = externalToolElement.getAttribute('id') || '';
                log(`Context-ID über id-Attribut: "${contextId}"`);

                // Methode 2: Alle möglichen Attribute durchsuchen
                if (!contextId || contextId.length < 20) {
                    const attributes = externalToolElement.attributes;
                    for (let i = 0; i < attributes.length; i++) {
                        const attr = attributes[i];
                        if (attr.value && /^[a-f0-9]{24}$/i.test(attr.value)) {
                            contextId = attr.value;
                            log(`Context-ID über Attribut '${attr.name}': "${contextId}"`);
                            break;
                        }
                    }
                }

                // Methode 3: Suche in onclick/data-* Attributen
                if (!contextId || contextId.length < 20) {
                    const allAttrs = ['onclick', 'data-context', 'data-id', 'data-tool-id', 'aria-label'];
                    for (const attrName of allAttrs) {
                        const attrValue = externalToolElement.getAttribute(attrName) || '';
                        const idMatch = attrValue.match(/[a-f0-9]{24}/i);
                        if (idMatch) {
                            contextId = idMatch[0];
                            log(`Context-ID über Attribut '${attrName}': "${contextId}"`);
                            break;
                        }
                    }
                }

                // Methode 4: Suche in parent/child Elementen
                if (!contextId || contextId.length < 20) {
                    const parent = externalToolElement.parentElement;
                    if (parent) {
                        const parentId = parent.getAttribute('id') || '';
                        if (/^[a-f0-9]{24}$/i.test(parentId)) {
                            contextId = parentId;
                            log(`Context-ID über Parent-Element: "${contextId}"`);
                        }
                    }
                }

                // Methode 5: HTML-Content nach IDs durchsuchen
                if (!contextId || contextId.length < 20) {
                    const htmlContent = externalToolElement.innerHTML;
                    const idMatches = htmlContent.match(/[a-f0-9]{24}/gi);
                    if (idMatches && idMatches.length > 0) {
                        contextId = idMatches[0];
                        log(`Context-ID über HTML-Content: "${contextId}"`);
                    }
                }

                log(`Externes Tool Debug Info:`, {
                    testId,
                    toolName,
                    displayName,
                    contextId,
                    contextIdLength: contextId.length,
                    element: externalToolElement
                });

                elementData.toolName = toolName;
                elementData.displayName = displayName;
                elementData.contextId = contextId;
                elementData.toolType = toolType;
                elementData.elementId = externalToolElement.getAttribute('id') || '';
                elementData.cardId = cardId;
                elementData.content = `🔧 Externes Tool: ${displayName} (${toolName})`;
                elementData.shouldBeBold = true;

                log(`Element ${index}: Externes Tool erkannt: ${displayName} (${toolName}, Context: ${contextId})`);

                if (contextId && contextId.length >= 20) {
                    elementData.needsToolIdExtraction = true;
                } else {
                    log(`WARNUNG: Context-ID zu kurz oder nicht gefunden für externes Tool: ${displayName}`);
                    elementData.needsContextIdLookup = true;
                }
            }

            if (elementData.type !== 'unknown') {
                elements.push(elementData);
            }
        });

        return elements;
    }

    // --- Formatversion erkennen ---
    function detectExportVersion(data) {
        const parsed = typeof data === 'string' ? JSON.parse(data) : data;
        if (parsed.version === '8.7' || parsed.version === '8.6' || parsed.version === '8.5' || parsed.version === '8.4' || parsed.version === '8.3' || parsed.version === '8.2' || parsed.version === '8.1' || parsed.version === '8.0' || parsed.version === '7.0' || parsed.version === '6.2' || parsed.version === '6.1' || parsed.version === '6.0' || parsed.version === '5.0' ||
            (parsed.columns && parsed.columns[0] && parsed.columns[0].cards && parsed.columns[0].cards[0] && parsed.columns[0].cards[0].elements)) {
            return parsed.version || '5.0';
        }
        return '4.x';
    }

    // --- Export-Funktion mit verbessertem Logging ---
    async function exportBoard() {
        try {
            notify('Exportiere...');
            const result = [];
            let totalFiles = 0;
            let totalElements = 0;
            let totalLinks = 0;
            let totalVideoConferences = 0;
            let totalExternalTools = 0;

            const columns = document.querySelectorAll('[data-testid^="board-column-"]');

            for (const col of columns) {
                const title = col.querySelector('[data-testid^="column-title-"]')?.textContent.trim() || '';
                const cards = [];

                const cardElements = col.querySelectorAll('[data-testid^="board-card-"]');

                for (const card of cardElements) {
                    const cardTitle = card.querySelector('[data-testid="card-title"]')?.textContent.trim() || '';
                    const elements = analyzeCardElements(card);

                    // VERBESSERTE Tool-IDs und Context-IDs für externe Tools extrahieren
                    for (const element of elements) {
                        if (element.type !== CONFIG.ELEMENT_TYPES.EXTERNAL_TOOL) continue;

                        if (element.needsContextIdLookup && element.cardId && element.elementId) {
                            try {
                                log(`Hole Context-ID über API für ${element.displayName} (Card ${element.cardId}, Element ${element.elementId})`);
                                element.contextId = await fetchContextIdFromApi(element.cardId, element.elementId);
                                log(`Context-ID via API: ${element.contextId}`);
                            } catch (err) {
                                log('Fehler beim Laden der Context-ID:', err);
                            }
                            delete element.needsContextIdLookup;
                        }

                        if (element.contextId && element.contextId.length >= 20) {
                            try {
                                log(`Starte Tool-ID Extraktion für: ${element.displayName} mit Context-ID: ${element.contextId}`);
                                element.toolId = await extractExternalToolId(element.contextId);
                                log(`Tool-ID für ${element.displayName} erfolgreich extrahiert: ${element.toolId}`);
                            } catch (error) {
                                log(`Fehler beim Extrahieren der Tool-ID für ${element.displayName}:`, error);
                                element.toolId = 'ExtractionFailed';
                            }
                            delete element.needsToolIdExtraction;
                        } else {
                            log(`FEHLER: Externes Tool ohne gültige Context-ID gefunden: ${element.displayName} (ID: "${element.contextId}")`);
                            element.toolId = 'NoValidContextId';
                        }
                    }

                    totalElements += elements.length;
                    let combinedContent = elements.map(e => e.content).join('');

                    const filesCount = elements.filter(e => e.type === CONFIG.ELEMENT_TYPES.FILE).length;
                    const linksCount = elements.filter(e => e.type === CONFIG.ELEMENT_TYPES.LINK).length;
                    const videoConferencesCount = elements.filter(e => e.type === CONFIG.ELEMENT_TYPES.VIDEO_CONFERENCE).length;
                    const externalToolsCount = elements.filter(e => e.type === CONFIG.ELEMENT_TYPES.EXTERNAL_TOOL).length;

                    totalFiles += filesCount;
                    totalLinks += linksCount;
                    totalVideoConferences += videoConferencesCount;
                    totalExternalTools += externalToolsCount;

                    if (elements.length === 0) {
                        log('Fallback auf alte Export-Methode für Karte:', cardTitle);
                        let textContentsFound = [];
                        const contentElements = card.querySelectorAll('[data-testid^="board-contentelement-"]');
                        contentElements.forEach((contentElement, index) => {
                            const ckContent = contentElement.querySelector('.ck-content, .ck-editor__editable[contenteditable="true"]');
                            if (ckContent) {
                                let elementContent = '';
                                if (ckContent.ckeditorInstance && typeof ckContent.ckeditorInstance.getData === 'function') {
                                    elementContent = ckContent.ckeditorInstance.getData();
                                } else if (ckContent.innerHTML) {
                                    elementContent = ckContent.innerHTML.trim();
                                }

                                if (elementContent) {
                                    textContentsFound.push(elementContent);
                                }
                            }
                        });

                        if (textContentsFound.length > 0) {
                            combinedContent = textContentsFound.join('');
                        }
                    }

                    cards.push({
                        title: cardTitle,
                        elements: elements,
                        content: combinedContent
                    });

                    log(`Karte "${cardTitle}" mit ${elements.length} Elementen exportiert (${externalToolsCount} Externe Tools)`);
                }

                result.push({
                    title,
                    cards
                });
            }

            const exportData = {
                exportDate: new Date().toISOString(),
                version: '8.7',
                totalColumns: result.length,
                totalCards: result.reduce((sum, col) => sum + col.cards.length, 0),
                totalFiles: totalFiles,
                totalLinks: totalLinks,
                totalVideoConferences: totalVideoConferences,
                totalExternalTools: totalExternalTools,
                totalElements: totalElements,
                columns: result
            };

            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
            a.download = `board-export-v8.7-${timestamp}.json`;
            a.click();
            URL.revokeObjectURL(a.href);

            notify(`Export erfolgreich! ${totalElements} Elemente (${totalExternalTools} Externe Tools) in ${exportData.totalCards} Karten.`, 'success');

            log('Export-Statistiken:', {
                Version: '8.7',
                Spalten: exportData.totalColumns,
                Karten: exportData.totalCards,
                ExterneTools: totalExternalTools,
                Elemente: totalElements
            });

        } catch (e) {
            log('Export-Fehler:', e);
            notify('Export fehlgeschlagen: ' + (e.message || e), 'error');
        }
    }

    // --- Button-Finder Funktionen ---
    function findAddColumnButton() {
        let span = Array.from(document.querySelectorAll('span.v-btn__content'))
            .find(sp => /Abschnitt hinzufügen|Spalte hinzufügen/i.test(sp.textContent));
        if (span) {
            const btn = span.closest('button');
            if (btn) return btn;
        }
        return document.querySelector('[data-testid="add-column"]');
    }

    async function findAddCardButton(colIdx) {
        log(`Suche Add-Card-Button für Spalte ${colIdx}...`);

        const directSelector = `[data-testid="column-${colIdx}-add-card-btn"]`;
        const directBtn = document.querySelector(directSelector);
        if (directBtn) {
            log(`Add-Card-Button für Spalte ${colIdx} gefunden: ${directSelector}`);
            return directBtn;
        }

        const selectors = [
            `[data-testid="add-card-btn-${colIdx}"]`,
            `[data-testid^="board-column-${colIdx}"] [data-testid*="add-card"]`,
            `[data-testid^="board-column-${colIdx}"] button[aria-label*="Karte"]`,
            `[data-testid^="board-column-${colIdx}"] button[aria-label*="hinzufügen"]`
        ];

        for (const selector of selectors) {
            const btn = document.querySelector(selector);
            if (btn) {
                log(`Add-Card-Button für Spalte ${colIdx} gefunden mit Fallback: ${selector}`);
                return btn;
            }
        }

        const column = document.querySelector(`[data-testid^="board-column-${colIdx}"]`);
        if (column) {
            log(`Suche in Spalte ${colIdx}...`);
            const buttons = column.querySelectorAll('button');
            for (const btn of buttons) {
                const text = btn.textContent.trim().toLowerCase();
                const testId = (btn.getAttribute('data-testid') || '').toLowerCase();
                const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();

                if (text.includes('hinzufügen') || text.includes('add') || text === '+' ||
                    testId.includes('add') || testId.includes('card') ||
                    ariaLabel.includes('add') || ariaLabel.includes('karte')) {
                    log(`Add-Card-Button für Spalte ${colIdx} über Text-Suche gefunden`);
                    return btn;
                }
            }

            const plusButtons = column.querySelectorAll('button');
            for (const btn of plusButtons) {
                const svg = btn.querySelector('svg');
                if (svg) {
                    const path = svg.querySelector('path');
                    if (path && path.getAttribute('d') &&
                        path.getAttribute('d').includes('M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z')) {
                        log(`Add-Card-Button für Spalte ${colIdx} über Plus-Icon gefunden`);
                        return btn;
                    }
                }
            }
        }

        debugColumnStructure();
        throw new Error(`Add-Card-Button für Spalte ${colIdx} nicht gefunden`);
    }

    // --- Element-Hinzufügen-Funktion ---
    async function addNewElement(elementData) {
        log(`Erstelle neues Element: ${elementData.type} - "${(elementData.content || '').substring(0, 50)}..."`);
        try {
            const addElementBtn = document.querySelector('[data-testid="add-element-btn"]');
            if (!addElementBtn) {
                throw new Error('Add-Element-Button nicht gefunden');
            }

            log('Klicke auf "Element hinzufügen"-Button');
            addElementBtn.click();
            await sleep(CONFIG.TIMING.ELEMENT_CREATION_DELAY);

            switch(elementData.type) {
                case CONFIG.ELEMENT_TYPES.TEXT:
                    await selectTextElement();
                    if (elementData.shouldBeBold) {
                        await insertBoldTextContent(elementData.content);
                    } else {
                        await insertTextContent(elementData.content);
                    }
                    break;

                case CONFIG.ELEMENT_TYPES.FILE:
                    await selectTextElement();
                    await insertBoldTextContent(`📎 Datei-Platzhalter: [${elementData.fileName}], ${elementData.fileInfo}`);
                    break;

                case CONFIG.ELEMENT_TYPES.DRAWING:
                    await selectWhiteboardElement();
                    log('Whiteboard-Element erfolgreich erstellt');
                    break;

                case CONFIG.ELEMENT_TYPES.COLLAB_EDITOR:
                    await selectEtherpadElement();
                    log('Etherpad-Element erfolgreich erstellt');
                    break;

                case CONFIG.ELEMENT_TYPES.VIDEO_CONFERENCE:
                    await selectVideoConferenceElement();
                    await insertVideoConferenceTitle(elementData.title);
                    log('Videokonferenz-Element erfolgreich erstellt');
                    break;

                case CONFIG.ELEMENT_TYPES.LINK:
                    await selectLinkElement();
                    await insertLinkUrl(elementData.url);
                    break;

                case CONFIG.ELEMENT_TYPES.EXTERNAL_TOOL:
                    await selectExternalToolElement();
                    await insertExternalToolData(elementData.toolName, elementData.displayName, elementData.toolId, elementData.toolType || 'Lichtblick');
                    log('Externes Tool-Element erfolgreich erstellt');
                    break;

                default:
                    await selectTextElement();
                    await insertTextContent(elementData.content);
            }

            log(`Element ${elementData.type} erfolgreich erstellt`);

        } catch (error) {
            log('Fehler beim Erstellen des Elements:', error);
            if (elementData.type === CONFIG.ELEMENT_TYPES.TEXT || elementData.type === CONFIG.ELEMENT_TYPES.FILE) {
                await appendToCurrentEditor(`${elementData.content}`);
            } else {
                log(`Kein Fallback für ${elementData.type}-Element - Element sollte bereits erstellt sein`);
            }
        }
    }

    // --- Element-Typ-Auswahl-Funktionen ---
    async function selectTextElement() {
        log('Wähle Text-Element aus...');
        const textElementBtn = document.querySelector('[data-testid="create-element-text"]');
        if (!textElementBtn) {
            throw new Error('Text-Element-Button nicht gefunden');
        }
        textElementBtn.click();
        await sleep(CONFIG.TIMING.ELEMENT_SELECTION_DELAY);
    }

    async function selectEtherpadElement() {
        log('Wähle Etherpad-Element aus...');
        const etherpadElementBtn = document.querySelector('[data-testid="create-element-collaborative-text-editor"]');
        if (!etherpadElementBtn) {
            throw new Error('Etherpad-Element-Button nicht gefunden');
        }
        etherpadElementBtn.click();
        await sleep(CONFIG.TIMING.ELEMENT_SELECTION_DELAY);
        log('Etherpad-Element wurde erfolgreich ausgewählt und erstellt');
    }

    async function selectWhiteboardElement() {
        log('Wähle Whiteboard-Element aus...');
        const whiteboardSelectors = [
            '[data-testid="create-element-drawing"]',
            '[data-testid="create-element-whiteboard"]',
            'button[data-testid*="drawing"]',
            'button[data-testid*="whiteboard"]'
        ];

        let whiteboardElementBtn = null;
        for (const selector of whiteboardSelectors) {
            whiteboardElementBtn = document.querySelector(selector);
            if (whiteboardElementBtn) {
                log(`Whiteboard-Button gefunden mit Selector: ${selector}`);
                break;
            }
        }

        if (!whiteboardElementBtn) {
            const buttons = document.querySelectorAll('button');
            for (const btn of buttons) {
                const text = btn.textContent.trim().toLowerCase();
                if (text.includes('whiteboard') || text.includes('zeichnung')) {
                    whiteboardElementBtn = btn;
                    log('Whiteboard-Button über Text-Suche gefunden');
                    break;
                }

                const svg = btn.querySelector('svg');
                if (svg) {
                    const path = svg.querySelector('path');
                    if (path && path.getAttribute('d') &&
                        path.getAttribute('d').includes('M2,3H10A2,2 0 0,1 12,1A2,2 0 0,1 14,3H22V5H21V16H15.25L17,22H15L13.25,16H10.75L9,22H7L8.75,16H3V5H2V3M5,5V14H19V5H5Z')) {
                        whiteboardElementBtn = btn;
                        log('Whiteboard-Button über SVG-Icon gefunden');
                        break;
                    }
                }
            }
        }

        if (!whiteboardElementBtn) {
            throw new Error('Whiteboard-Element-Button nicht gefunden');
        }

        whiteboardElementBtn.click();
        await sleep(CONFIG.TIMING.ELEMENT_SELECTION_DELAY);
        log('Whiteboard-Element wurde erfolgreich ausgewählt und erstellt');
    }

    async function selectVideoConferenceElement() {
        log('Wähle Videokonferenz-Element aus...');
        const videoConferenceElementBtn = document.querySelector('[data-testid="create-element-video-conference"]');
        if (!videoConferenceElementBtn) {
            throw new Error('Videokonferenz-Element-Button nicht gefunden');
        }
        videoConferenceElementBtn.click();
        await sleep(CONFIG.TIMING.ELEMENT_SELECTION_DELAY);
        log('Videokonferenz-Element wurde erfolgreich ausgewählt');
    }

    async function insertVideoConferenceTitle(title) {
        log(`Füge Videokonferenz-Titel ein: ${title}`);
        await sleep(CONFIG.TIMING.UI_STABILIZATION_DELAY);

        const activeElement = document.activeElement;
        if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
            activeElement.value = title;
            activeElement.dispatchEvent(new Event('input', { bubbles: true }));
            await sleep(CONFIG.TIMING.LINK_INPUT_DELAY);
            activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
            await sleep(CONFIG.TIMING.ELEMENT_CONTENT_DELAY);
            log('Videokonferenz-Titel erfolgreich eingegeben und bestätigt');
        } else {
            const titleInput = document.querySelector('input[type="text"], input[placeholder*="Titel"], textarea[placeholder*="Titel"]');
            if (titleInput) {
                titleInput.focus();
                await sleep(200);
                titleInput.value = title;
                titleInput.dispatchEvent(new Event('input', { bubbles: true }));
                await sleep(CONFIG.TIMING.LINK_INPUT_DELAY);
                titleInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
                await sleep(CONFIG.TIMING.ELEMENT_CONTENT_DELAY);
                log('Videokonferenz-Titel über Eingabefeld-Suche eingegeben');
            } else {
                throw new Error('Videokonferenz-Titel-Eingabefeld nicht gefunden');
            }
        }
    }

    async function selectLinkElement() {
        log('Wähle Link-Element aus...');
        const linkElementBtn = document.querySelector('[data-testid="create-element-link"]');
        if (!linkElementBtn) {
            throw new Error('Link-Element-Button nicht gefunden');
        }
        linkElementBtn.click();
        await sleep(CONFIG.TIMING.ELEMENT_SELECTION_DELAY);
        log('Link-Element wurde erfolgreich ausgewählt');
    }

    async function insertLinkUrl(url) {
        log(`Füge Link-URL ein: ${url}`);
        await sleep(CONFIG.TIMING.UI_STABILIZATION_DELAY);

        const linkInput = document.querySelector('input[type="url"], input[placeholder*="URL"], input[placeholder*="Link"], input[placeholder*="http"]');
        if (linkInput) {
            linkInput.focus();
            await sleep(200);
            linkInput.value = url;
            linkInput.dispatchEvent(new Event('input', { bubbles: true }));
            await sleep(CONFIG.TIMING.LINK_INPUT_DELAY);
            linkInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
            await sleep(CONFIG.TIMING.ELEMENT_CONTENT_DELAY);
            log('Link-URL erfolgreich eingegeben und bestätigt');
        } else {
            const activeElement = document.activeElement;
            if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
                activeElement.value = url;
                activeElement.dispatchEvent(new Event('input', { bubbles: true }));
                await sleep(CONFIG.TIMING.LINK_INPUT_DELAY);
                activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
                await sleep(CONFIG.TIMING.ELEMENT_CONTENT_DELAY);
                log('Link-URL über aktives Element eingegeben');
            } else {
                throw new Error('Link-Eingabefeld nicht gefunden');
            }
        }
    }

    // --- Externes Tool-Element auswählen ---
    async function selectExternalToolElement() {
        log('Wähle Externes Tool-Element aus...');

        const buttons = document.querySelectorAll('button');
        let externalToolBtn = null;

        for (const btn of buttons) {
            const svg = btn.querySelector('svg');
            if (svg) {
                const path = svg.querySelector('path');
                if (path && path.getAttribute('d') &&
                    path.getAttribute('d').includes('M22,13.5C22,15.26 20.7,16.72 19,16.96V20A2,2 0 0,1 17,22H13.2V21.7A2.7,2.7 0 0,0 10.5,19C9,19 7.8,20.21 7.8,21.7V22H4A2,2 0 0,1 2,20V16.2H2.3C3.79,16.2 5,15 5,13.5C5,12 3.79,10.8 2.3,10.8H2V7A2,2 0 0,1 4,5H7.04C7.28,3.3 8.74,2 10.5,2C12.26,2 13.72,3.3 13.96,5H17A2,2 0 0,1 19,7V10.04C20.7,10.28 22,11.74 22,13.5')) {
                    externalToolBtn = btn;
                    log('Externe Tools Button über SVG-Icon gefunden');
                    break;
                }
            }
        }

        if (!externalToolBtn) {
            const externalToolButtons = document.querySelectorAll('span.v-btn__content');
            for (const btnContent of externalToolButtons) {
                const subtitleElement = btnContent.querySelector('span.subtitle');
                if (subtitleElement && subtitleElement.textContent.trim() === 'Externe Tools') {
                    externalToolBtn = btnContent.closest('button');
                    log('Externe Tools Button über Subtitle gefunden');
                    break;
                }
            }
        }

        if (!externalToolBtn) {
            throw new Error('Externes Tool-Element-Button nicht gefunden');
        }

        externalToolBtn.click();
        await sleep(CONFIG.TIMING.ELEMENT_SELECTION_DELAY);
        log('Externes Tool-Element wurde erfolgreich ausgewählt');
    }

    // --- VOLLSTÄNDIG ÜBERARBEITETE Externe Tool-Daten einfügen ---
    async function insertExternalToolData(toolName, displayName, toolId, toolType = 'Lichtblick') {
        log(`Füge Externe Tool-Daten ein: ${toolType} (${displayName}) - ID: ${toolId}`);
        await sleep(CONFIG.TIMING.UI_STABILIZATION_DELAY);

        // Schritt 3: Tool-Auswahl Feld suchen
        log('Schritt 3: Suche Tool-Auswahl Feld...');
        const toolSelectionInput = document.querySelector('input[type="text"]');
        if (!toolSelectionInput) throw new Error('Tool-Auswahl Eingabefeld nicht gefunden');

        toolSelectionInput.focus();
        await sleep(200);

        if (toolType === 'Bettermarks') {
            toolSelectionInput.value = 'Bettermarks';
            toolSelectionInput.dispatchEvent(new Event('input', { bubbles: true }));
            await sleep(CONFIG.TIMING.DROPDOWN_WAIT_DELAY);
            toolSelectionInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
            await sleep(200);
            toolSelectionInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
            await sleep(CONFIG.TIMING.EXTERNAL_TOOL_DELAY);
            log('Schritt 3: Bettermarks ausgewählt');
        } else {
            toolSelectionInput.value = 'Licht';
            toolSelectionInput.dispatchEvent(new Event('input', { bubbles: true }));
            await sleep(CONFIG.TIMING.DROPDOWN_WAIT_DELAY);
            log('Schritt 3: "Licht" in Tool-Auswahl eingegeben');

            // Schritt 4: Auf Dropdown-Item "Lichtblick-Filmsequenz" klicken
            log('Schritt 4: Suche Lichtblick-Filmsequenz Dropdown-Item...');
            const dropdownItems = document.querySelectorAll('[data-testid="configuration-select-item"]');
            let lichtblickItem = null;
            for (const item of dropdownItems) {
                const titleElement = item.querySelector('.v-list-item-title');
                if (titleElement && titleElement.textContent.trim() === 'Lichtblick-Filmsequenz') {
                    lichtblickItem = item;
                    log('Schritt 4: Lichtblick-Filmsequenz Item gefunden');
                    break;
                }
            }
            if (lichtblickItem) {
                lichtblickItem.click();
                await sleep(CONFIG.TIMING.EXTERNAL_TOOL_DELAY);
                log('Schritt 4: Lichtblick-Filmsequenz ausgewählt');
            } else {
                const allListItems = document.querySelectorAll('.v-list-item');
                for (const item of allListItems) {
                    const titleElement = item.querySelector('.v-list-item-title');
                    if (titleElement && titleElement.textContent.trim() === 'Lichtblick-Filmsequenz') {
                        item.click();
                        await sleep(CONFIG.TIMING.EXTERNAL_TOOL_DELAY);
                        log('Schritt 4: Lichtblick-Filmsequenz über Fallback ausgewählt');
                        break;
                    }
                }
            }
        }

        // Schritt 5: Anzeigenamen setzen
        log('Schritt 5: Setze Anzeigenamen...');
        await sleep(CONFIG.TIMING.FIELD_DELAY);

        let displayNameInput = findInputByLabelText('Anzeigename');
        if (!displayNameInput) {
            displayNameInput = document.querySelector('input[placeholder*="Anzeigename"]');
        }
        if (displayNameInput) {
            displayNameInput.focus();
            await sleep(200);
            displayNameInput.value = displayName;
            displayNameInput.dispatchEvent(new Event('input', { bubbles: true }));
            await sleep(CONFIG.TIMING.FIELD_DELAY);
            displayNameInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
            log('Schritt 5: Anzeigename erfolgreich gesetzt');
        } else {
            log('Schritt 5: Anzeigename-Feld nicht gefunden - verwende Standard');
        }
        if (toolType !== 'Bettermarks') {
            // Schritt 6: Tool-ID in das Filmsequenz-Feld eingeben
            log('Schritt 6: Setze Tool-ID ins Filmsequenz-Feld...');
            await sleep(CONFIG.TIMING.FIELD_DELAY);

            const toolIdInput = document.querySelector('[data-testid="id"] input, input[id*="input-v-121"]');
            if (toolIdInput) {
                toolIdInput.focus();
                await sleep(200);
                toolIdInput.value = toolId;
                toolIdInput.dispatchEvent(new Event('input', { bubbles: true }));
                await sleep(CONFIG.TIMING.FIELD_DELAY);
                log('Schritt 6: Tool-ID erfolgreich eingegeben');
            } else {
                throw new Error('Tool-ID Eingabefeld nicht gefunden');
            }

            // Schritt 7: Hinzufügen-Button klicken
            log('Schritt 7: Klicke Hinzufügen-Button...');
            await sleep(CONFIG.TIMING.FIELD_DELAY);

            const addButton = document.querySelector('[data-testid="save-button"]');
            if (addButton) {
                addButton.click();
                await sleep(CONFIG.TIMING.ELEMENT_CONTENT_DELAY);
                log('Schritt 7: Externes Tool erfolgreich hinzugefügt');
            } else {
                throw new Error('Hinzufügen-Button nicht gefunden');
            }
        } else {
            // Bettermarks benötigt keine Tool-ID
            log('Schritt 6: Bestätige Bettermarks hinzufügen...');
            await sleep(CONFIG.TIMING.FIELD_DELAY);
            const addButton = document.querySelector('[data-testid="save-button"]');
            if (addButton) {
                addButton.click();
                await sleep(CONFIG.TIMING.ELEMENT_CONTENT_DELAY);
                log('Schritt 6: Bettermarks-Tool hinzugefügt');
            } else {
                throw new Error('Hinzufügen-Button nicht gefunden');
            }
        }
    }

    // --- Bold-Text einfügen ---
    async function insertBoldTextContent(content) {
        log('Füge fetten Text-Inhalt ein...');
        await sleep(CONFIG.TIMING.UI_STABILIZATION_DELAY);

        const editors = document.querySelectorAll('.ck-editor__editable[contenteditable="true"]');
        const latestEditor = editors[editors.length - 1];

        if (latestEditor && latestEditor.ckeditorInstance) {
            await latestEditor.ckeditorInstance.setData(content);
            await sleep(CONFIG.TIMING.BOLD_FORMATTING_DELAY);

            const model = latestEditor.ckeditorInstance.model;
            const doc = model.document;
            model.change(writer => {
                writer.setSelection(doc.getRoot(), 'in');
            });

            await sleep(CONFIG.TIMING.BOLD_FORMATTING_DELAY);
            latestEditor.ckeditorInstance.execute('bold');
            log('Fetten Text über CKEditor API eingefügt und Bold-Formatierung angewendet');
        } else if (latestEditor) {
            latestEditor.focus();
            await sleep(200);
            latestEditor.innerHTML = `<strong>${content}</strong>`;
            latestEditor.dispatchEvent(new Event('input', { bubbles: true }));
            log('Fetten Text über innerHTML mit <strong>-Tag eingefügt');
        } else {
            throw new Error('Neuer Editor nicht gefunden');
        }

        await sleep(CONFIG.TIMING.ELEMENT_CONTENT_DELAY);
    }

    // --- Text in neues Element einfügen (normal) ---
    async function insertTextContent(content) {
        log('Füge Text-Inhalt ein...');
        await sleep(CONFIG.TIMING.UI_STABILIZATION_DELAY);

        const editors = document.querySelectorAll('.ck-editor__editable[contenteditable="true"]');
        const latestEditor = editors[editors.length - 1];

        if (latestEditor && latestEditor.ckeditorInstance) {
            await latestEditor.ckeditorInstance.setData(content);
            log('Text über CKEditor API eingefügt');
        } else if (latestEditor) {
            latestEditor.focus();
            await sleep(200);
            latestEditor.innerHTML = content;
            latestEditor.dispatchEvent(new Event('input', { bubbles: true }));
            log('Text über innerHTML eingefügt');
        } else {
            throw new Error('Neuer Editor nicht gefunden');
        }

        await sleep(CONFIG.TIMING.ELEMENT_CONTENT_DELAY);
    }

    async function appendToCurrentEditor(content) {
        log('Fallback: Füge Text zum aktuellen Editor hinzu');
        const editor = document.querySelector('.ck-editor__editable[contenteditable="true"]');
        if (editor && editor.ckeditorInstance) {
            const currentContent = editor.ckeditorInstance.getData();
            await editor.ckeditorInstance.setData(currentContent + content);
        } else if (editor) {
            editor.innerHTML += content;
            editor.dispatchEvent(new Event('input', { bubbles: true }));
        }
    }

    function setValue(el, val) {
        const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value')?.set;
        if (setter) setter.call(el, val);
        else el.value = val;
        el.dispatchEvent(new Event('input', { bubbles: true }));
    }

    function findInputByLabelText(text) {
        const labels = Array.from(document.querySelectorAll('label'));
        for (const label of labels) {
            if (label.textContent && label.textContent.trim() === text && label.getAttribute('for')) {
                const input = document.getElementById(label.getAttribute('for'));
                if (input) return input;
            }
        }
        return null;
    }

    async function addColumn(title) {
        notify(`Spalte anlegen: "${title}"`);
        const btn = findAddColumnButton();
        if (!btn) throw new Error('Add-Column-Button nicht gefunden');

        btn.click();
        await sleep(CONFIG.TIMING.CLICK_DELAY);

        const input = document.querySelector('input[placeholder*="Titel"], textarea[placeholder*="Titel"]');
        if (!input) throw new Error('Spalten-Titel-Feld nicht gefunden');

        input.click();
        await sleep(200);
        setValue(input, title);
        await sleep(200);
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        await sleep(CONFIG.TIMING.COLUMN_CREATION_DELAY);
    }

    async function addCard(colIdx, card) {
        const isLegacyCard = !card.elements || card.elements.length === 0;
        const elementCount = isLegacyCard ? 1 : card.elements.length;
        notify(`Karte anlegen in Spalte ${colIdx+1}: "${card.title}" (${elementCount} Elemente)`);

        await sleep(CONFIG.TIMING.BUTTON_SEARCH_DELAY);
        const btn = await findAddCardButton(colIdx);
        btn.click();
        await sleep(CONFIG.TIMING.CLICK_DELAY);

        const titleField = document.querySelector('input[placeholder*="Titel"], textarea[placeholder*="Titel"]');
        if (!titleField) throw new Error('Karten-Titel-Feld nicht gefunden');

        titleField.click();
        await sleep(200);
        setValue(titleField, card.title);
        await sleep(200);
        titleField.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        await sleep(CONFIG.TIMING.FIELD_DELAY);

        if (card.elements && card.elements.length > 0) {
            const firstElement = card.elements[0];
            if (firstElement.type === CONFIG.ELEMENT_TYPES.TEXT) {
                if (firstElement.shouldBeBold) {
                    await setFirstElementContentBold(firstElement.content);
                } else {
                    await setFirstElementContent(firstElement.content);
                }
            } else {
                await addNewElement(firstElement);
            }

            for (let i = 1; i < card.elements.length; i++) {
                try {
                    await addNewElement(card.elements[i]);
                } catch (error) {
                    log(`Fehler beim Hinzufügen von Element ${i}:`, error);
                    if (card.elements[i].type === CONFIG.ELEMENT_TYPES.TEXT) {
                        await appendToCurrentEditor(`${card.elements[i].content}`);
                    }
                }
            }
        } else {
            await setFirstElementContent(card.content);
        }

        document.body.click();
        await sleep(CONFIG.TIMING.ACTION_DELAY);
    }

    // --- Erstes Element mit Bold-Formatierung setzen ---
    async function setFirstElementContentBold(content) {
        let editable = document.querySelector('.ck-editor__editable[contenteditable="true"]');
        let editorInstance = editable?.ckeditorInstance;

        if (!editorInstance) {
            const ckContent = document.querySelector('div.ck-content');
            editorInstance = ckContent?.ckeditorInstance;
            editable = ckContent;
        }

        if (editorInstance && typeof editorInstance.setData === 'function') {
            notify('Setze fetten Karten-Inhalt über CKEditor5 API');
            await editorInstance.setData(content);
            await sleep(CONFIG.TIMING.BOLD_FORMATTING_DELAY);

            const model = editorInstance.model;
            const doc = model.document;
            model.change(writer => {
                writer.setSelection(doc.getRoot(), 'in');
            });

            await sleep(CONFIG.TIMING.BOLD_FORMATTING_DELAY);
            editorInstance.execute('bold');
            await sleep(CONFIG.TIMING.FIELD_DELAY);
        } else if (editable) {
            notify('Setze fetten Karten-Inhalt via innerHTML-Fallback');
            editable.focus();
            await sleep(CONFIG.TIMING.FIELD_DELAY);
            editable.innerHTML = `<strong>${content}</strong>`;
            editable.dispatchEvent(new Event('input', { bubbles: true }));
            await sleep(CONFIG.TIMING.FIELD_DELAY);
        } else {
            throw new Error('Karten-Inhalt-Editor nicht gefunden');
        }
    }

    // --- Erstes Element setzen (normal) ---
    async function setFirstElementContent(content) {
        let editable = document.querySelector('.ck-editor__editable[contenteditable="true"]');
        let editorInstance = editable?.ckeditorInstance;

        if (!editorInstance) {
            const ckContent = document.querySelector('div.ck-content');
            editorInstance = ckContent?.ckeditorInstance;
            editable = ckContent;
        }

        if (editorInstance && typeof editorInstance.setData === 'function') {
            notify('Setze Karten-Inhalt über CKEditor5 API');
            await editorInstance.setData(content);
            await sleep(CONFIG.TIMING.FIELD_DELAY);
        } else if (editable) {
            notify('Setze Karten-Inhalt via innerHTML-Fallback');
            editable.focus();
            await sleep(CONFIG.TIMING.FIELD_DELAY);
            editable.innerHTML = content;
            editable.dispatchEvent(new Event('input', { bubbles: true }));
            await sleep(CONFIG.TIMING.FIELD_DELAY);
        } else {
            throw new Error('Karten-Inhalt-Editor nicht gefunden');
        }
    }

    async function importBoard(data) {
        try {
            notify('Importiere...');
            const parsed = typeof data === 'string' ? JSON.parse(data) : data;
            const version = detectExportVersion(parsed);
            const cols = Array.isArray(parsed) ? parsed : (parsed.columns || []);

            if (!cols.length) {
                notify('Keine Spalten in der Datei', 'error');
                return;
            }

            log(`Import-Version erkannt: ${version}`);
            if (parsed.totalFiles) {
                log(`Import-Info: ${parsed.totalColumns} Spalten, ${parsed.totalCards} Karten, ${parsed.totalFiles} Dateien`);
            }
            if (parsed.totalLinks) {
                log(`Import-Info: ${parsed.totalLinks} Links`);
            }
            if (parsed.totalVideoConferences) {
                log(`Import-Info: ${parsed.totalVideoConferences} Videokonferenzen`);
            }
            if (parsed.totalExternalTools) {
                log(`Import-Info: ${parsed.totalExternalTools} Externe Tools`);
            }
            if (parsed.totalElements) {
                log(`Import-Info: ${parsed.totalElements} Elemente total`);
            }

            for (let i = 0; i < cols.length; i++) {
                await addColumn(cols[i].title);
            }

            document.activeElement.blur();
            await sleep(CONFIG.TIMING.COLUMN_STABILIZATION_DELAY);
            debugColumnStructure();

            for (let i = 0; i < cols.length; i++) {
                for (const card of (cols[i].cards || [])) {
                    await addCard(i, card);
                }
            }

            const importMessage = version === '8.7' ?
                `Import erfolgreich! ${parsed.totalElements || 'Unbekannte Anzahl'} Elemente importiert. (v8.7)` :
                version === '8.6' ?
                `Import erfolgreich! ${parsed.totalElements || 'Unbekannte Anzahl'} Elemente importiert. (v8.6)` :
                version === '8.5' ?
                `Import erfolgreich! ${parsed.totalElements || 'Unbekannte Anzahl'} Elemente importiert. (v8.5)` :
                version === '8.4' ?
                `Import erfolgreich! ${parsed.totalElements || 'Unbekannte Anzahl'} Elemente importiert. (v8.4)` :
                version === '8.3' ?
                `Import erfolgreich! ${parsed.totalElements || 'Unbekannte Anzahl'} Elemente importiert. (v8.3)` :
                version === '8.2' ?
                `Import erfolgreich! ${parsed.totalElements || 'Unbekannte Anzahl'} Elemente importiert. (v8.2)` :
                'Import erfolgreich! (Legacy-Format)';

            notify(importMessage, 'success');

        } catch (e) {
            log('Import-Fehler:', e);
            notify('Import fehlgeschlagen: ' + (e.message || e), 'error');
        }
    }

    function initUI() {
        if (document.getElementById('nbc-ui')) return;

        const wrapper = document.createElement('div');
        wrapper.id = 'nbc-ui';
        Object.assign(wrapper.style, {
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            zIndex: 2147483647,
            display: 'flex',
            gap: '8px'
        });

        const expBtn = document.createElement('button');
        expBtn.textContent = 'Export v8.7';
        Object.assign(expBtn.style, {
            padding: '8px 12px',
            border: 'none',
            borderRadius: '4px',
            background: '#2196f3',
            color: '#fff',
            cursor: 'pointer',
            fontSize: '12px'
        });
        expBtn.addEventListener('click', exportBoard);

        const impBtn = document.createElement('button');
        impBtn.textContent = 'Import';
        Object.assign(impBtn.style, {
            padding: '8px 12px',
            border: 'none',
            borderRadius: '4px',
            background: '#4caf50',
            color: '#fff',
            cursor: 'pointer',
            fontSize: '12px'
        });

        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.json';
        fileInput.style.display = 'none';
        fileInput.addEventListener('change', () => {
            const f = fileInput.files[0];
            if (f) {
                const r = new FileReader();
                r.onload = () => importBoard(r.result);
                r.readAsText(f);
            }
        });

        impBtn.addEventListener('click', () => fileInput.click());

        wrapper.append(expBtn, impBtn, fileInput);
        document.body.appendChild(wrapper);
    }

    initUI();
    setInterval(initUI, 3000);

})();
