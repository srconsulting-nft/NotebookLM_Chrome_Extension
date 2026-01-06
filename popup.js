// NotebookLM Collector Pro - Popup Logic (v3.0 Agile)
document.addEventListener('DOMContentLoaded', () => {
    const listElement = document.getElementById('list');
    const addBtn = document.getElementById('add-current');
    const exportSelectBtn = document.getElementById('export-select');
    const exportNewBtn = document.getElementById('export-new');
    const clearBtn = document.getElementById('clear');

    const selectionSection = document.getElementById('notebook-selection-section');
    const nbListElement = document.getElementById('notebook-list');
    const syncBtn = document.getElementById('sync-notebooks');

    const updateUI = () => {
        chrome.storage.local.get(['items', 'cachedNotebooks'], (data) => {
            // 1. Mostrar Items capturados (Link o Texto)
            const items = data.items || [];
            listElement.innerHTML = items.map(it => `
                <li class="link-item">
                    ${it.type === 'url' ? '🔗' : '🗒️'} ${it.title || it.value.substring(0, 30)}
                </li>
            `).join('');

            exportSelectBtn.disabled = items.length === 0;
            exportNewBtn.disabled = items.length === 0;

            // Actualizar Badge
            chrome.action.setBadgeBackgroundColor({ color: "#6e45e2" });
            chrome.action.setBadgeText({ text: items.length > 0 ? items.length.toString() : "" });

            // 2. Mostrar Cuadernos Cachados
            const notebooks = data.cachedNotebooks || [];
            if (notebooks.length === 0) {
                nbListElement.innerHTML = '<div class="empty-state">No hay cuadernos cargados</div>';
            } else {
                nbListElement.innerHTML = notebooks.map((nb, i) => `
                    <div class="nb-item" data-url="${nb.url}">
                        <span class="nb-emoji">${nb.emoji || "📓"}</span>
                        <span class="nb-name">${nb.name}</span>
                    </div>
                `).join('');

                // Eventos para cada cuaderno
                document.querySelectorAll('.nb-item').forEach(item => {
                    item.addEventListener('click', () => sendToExisting(item.dataset.url));
                });
            }
        });
    };

    updateUI();

    // Añadir link actual
    addBtn.addEventListener('click', async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const urlObj = new URL(tab.url);
        const host = urlObj.hostname;

        // Detectar si estamos en un sitio de IA compatible
        const isAISite = host.includes('chatgpt.com') || host.includes('gemini.google.com') || host.includes('claude.ai') || host.includes('perplexity.ai');

        if (isAISite) {
            addBtn.innerText = "⏳ Extrayendo...";
            addBtn.disabled = true;

            chrome.tabs.sendMessage(tab.id, { action: "GET_CHAT_CONTENT" }, (response) => {
                addBtn.innerText = "Añadir Actual";
                addBtn.disabled = false;

                if (response && response.text) {
                    chrome.storage.local.get(['items'], (data) => {
                        const items = data.items || [];
                        items.push({
                            type: 'text',
                            value: response.text,
                            title: `AI Chat: ${tab.title || host}`,
                            url: tab.url
                        });
                        chrome.storage.local.set({ items }, updateUI);
                    });
                } else {
                    console.error("[NB-PRO] Falló la extracción:", response ? response.error : "No responde el script");
                    alert("⚠️ No pudimos extraer el texto de esta charla. Asegúrate de que la página esté cargada y no sea una conversación vacía.");
                }
            });
        } else {
            saveAsUrl(tab);
        }
    });

    function saveAsUrl(tab) {
        chrome.storage.local.get(['items'], (data) => {
            const items = data.items || [];
            if (!items.find(it => it.value === tab.url)) {
                items.push({
                    type: 'url',
                    value: tab.url,
                    title: tab.title || "Página actual",
                    url: tab.url
                });
                chrome.storage.local.set({ items }, updateUI);
            }
        });
    }

    // Alternar sección de selección
    exportSelectBtn.addEventListener('click', () => {
        const isHidden = selectionSection.style.display === 'none';
        selectionSection.style.display = isHidden ? 'block' : 'none';
    });

    // Sincronizar cuadernos
    syncBtn.addEventListener('click', async () => {
        await chrome.storage.local.set({
            isProcessing: true,
            automationStep: 'SCANNING'
        });
        chrome.tabs.create({ url: 'https://notebooklm.google.com/' });
        window.close();
    });

    // Enviar a cuaderno existente
    async function sendToExisting(url) {
        const state = await chrome.storage.local.get(['items']);
        if (!state.items || state.items.length === 0) return;

        await chrome.storage.local.set({
            isProcessing: true,
            automationStep: 'UPLOADING',
            targetNotebookUrl: url
        });
        chrome.tabs.create({ url: url });
        window.close();
    }

    // Crear nuevo cuaderno y enviar (Flujo original)
    exportNewBtn.addEventListener('click', async () => {
        const state = await chrome.storage.local.get(['items']);
        if (!state.items || state.items.length === 0) return;

        await chrome.storage.local.set({
            isProcessing: true,
            automationStep: 'CREATING'
        });
        chrome.tabs.create({ url: 'https://notebooklm.google.com/' });
        window.close();
    });

    clearBtn.addEventListener('click', () => {
        chrome.storage.local.set({ items: [], isProcessing: false, automationStep: 'IDLE' }, updateUI);
    });
});
