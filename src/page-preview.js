/**
 * <page-preview src="..."> — карточка предпросмотра HTML-страницы.
 *
 * Загружает страницу по адресу из атрибута src, извлекает document.title
 * и текст первого <h1> и показывает их вместе со ссылкой на страницу.
 * Импорт модуля сам регистрирует элемент.
 */

const MISSING_TITLE = 'Название отсутствует';
const MISSING_HEADING = 'Заголовок отсутствует';

// Шаблон создаётся один раз из постоянной разметки; каждый экземпляр
// получает собственную копию template.content.
const template = document.createElement('template');
template.innerHTML = `
  <style>
    :host {
      display: block;
      max-width: 32rem;
      font: 14px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      color: #1f2328;
    }
    :host([hidden]) { display: none; }

    .card {
      position: relative;
      box-sizing: border-box;
      padding: 14px 16px 12px;
      border: 1px solid #d0d7de;
      border-left: 4px solid #8c959f;
      border-radius: 8px;
      background: #ffffff;
      box-shadow: 0 1px 2px rgb(31 35 40 / 0.06);
    }
    :host([data-status="ready"]) .card { border-left-color: #1a7f37; }
    :host([data-status="loading"]) .card { border-left-color: #0969da; }
    :host([data-status="error"]) .card { border-left-color: #cf222e; }

    a {
      display: inline-block;
      max-width: 100%;
      font-size: 16px;
      font-weight: 600;
      color: #0969da;
      text-decoration: none;
      overflow-wrap: anywhere;
    }
    a:hover { text-decoration: underline; }
    a:focus-visible { outline: 2px solid #0969da; outline-offset: 2px; border-radius: 2px; }

    .url {
      margin-top: 2px;
      font-size: 12px;
      color: #656d76;
      overflow-wrap: anywhere;
    }

    dl { margin-top: 10px; }

    dl { margin-bottom: 0; display: grid; grid-template-columns: max-content 1fr; gap: 4px 12px; }
    dt { color: #656d76; }
    dd { margin: 0; overflow-wrap: anywhere; white-space: pre-wrap; }

    .status {
      margin: 10px 0 0;
      font-size: 12px;
      color: #656d76;
    }
    .status:empty { display: none; }
    :host([data-status="error"]) .status { color: #cf222e; }

    @media (prefers-color-scheme: dark) {
      :host { color: #e6edf3; }
      .card { background: #161b22; border-color: #30363d; box-shadow: none; }
      a { color: #4493f8; }
      .url, dt, .status { color: #8d96a0; }
      :host([data-status="error"]) .status { color: #f85149; }
    }
  </style>
  <article class="card" part="card">
    <a part="link"></a>
    <div class="url" part="url"></div>
    <dl>
      <dt>Название</dt>
      <dd><span part="title"></span></dd>
      <dt>Заголовок</dt>
      <dd><span part="heading"></span></dd>
    </dl>
    <p class="status" part="status" role="status" aria-live="polite"></p>
  </article>
`;

/**
 * Декодирует тело ответа с учётом кодировки из Content-Type или <meta charset>.
 * По умолчанию UTF-8, как и response.text().
 */
function decodeHtml(buffer, contentType) {
  let label = /charset\s*=\s*["']?([\w-]+)/i.exec(contentType ?? '')?.[1];
  if (!label) {
    const head = new TextDecoder('latin1').decode(buffer.slice(0, 1024));
    label = /<meta[^>]+charset\s*=\s*["']?([\w-]+)/i.exec(head)?.[1];
  }
  try {
    return new TextDecoder(label || 'utf-8').decode(buffer);
  } catch {
    return new TextDecoder('utf-8').decode(buffer);
  }
}

export class PagePreview extends HTMLElement {
  static observedAttributes = ['src'];

  // DOM-ссылки внутри Shadow DOM
  #link;
  #url;
  #title;
  #heading;
  #status;

  // Состояние загрузки
  #controller = null; // AbortController текущего запроса
  #pendingSrc = null; // значение src, для которого идёт запрос
  #generation = 0; // счётчик поколений: ответ старого поколения игнорируется

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    root.append(template.content.cloneNode(true));

    this.#link = root.querySelector('[part="link"]');
    this.#url = root.querySelector('[part="url"]');
    this.#title = root.querySelector('[part="title"]');
    this.#heading = root.querySelector('[part="heading"]');
    this.#status = root.querySelector('[part="status"]');
  }

  get src() {
    return this.getAttribute('src') ?? '';
  }

  set src(value) {
    this.setAttribute('src', value);
  }

  connectedCallback() {
    this.#load();
  }

  disconnectedCallback() {
    this.#cancel();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name !== 'src' || oldValue === newValue) return;
    // Пока элемент не в документе, загрузку начнёт connectedCallback.
    if (!this.isConnected) return;
    this.#load();
  }

  /** Отменяет незавершённый запрос; его результат больше не будет использован. */
  #cancel() {
    this.#generation++;
    this.#controller?.abort();
    this.#controller = null;
    this.#pendingSrc = null;
  }

  #isCurrent(generation) {
    return generation === this.#generation && this.isConnected;
  }

  async #load() {
    const src = this.getAttribute('src');

    // При начальном разборе attributeChangedCallback и connectedCallback
    // вызываются подряд для одного и того же src — второй запрос не нужен.
    if (this.#controller && this.#pendingSrc === src) return;

    this.#cancel();
    const generation = this.#generation;

    if (src === null || src.trim() === '') {
      this.#showError(null, 'Атрибут src не указан.');
      return;
    }

    let url;
    try {
      url = new URL(src, document.baseURI);
    } catch {
      this.#showError(null, `Некорректный адрес: ${src}`);
      return;
    }

    const controller = new AbortController();
    this.#controller = controller;
    this.#pendingSrc = src;
    this.#showLoading(url);

    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}${response.statusText ? ' ' + response.statusText : ''}`);
      }
      const buffer = await response.arrayBuffer();
      if (!this.#isCurrent(generation)) return;

      const html = decodeHtml(buffer, response.headers.get('content-type'));
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const title = doc.title.trim();
      const heading = doc.querySelector('h1')?.textContent.trim() ?? '';

      this.#showReady(url, title, heading);
    } catch (error) {
      if (!this.#isCurrent(generation)) return;
      const reason = error instanceof TypeError ? 'сетевая ошибка' : error.message;
      this.#showError(url, `Не удалось загрузить страницу: ${reason}`);
    } finally {
      if (generation === this.#generation) {
        this.#controller = null;
        this.#pendingSrc = null;
      }
    }
  }

  // Все значения со страницы выводятся только через textContent.

  #setLink(url, text) {
    if (url) {
      this.#link.href = url.href;
    } else {
      this.#link.removeAttribute('href');
    }
    this.#link.textContent = text;
    // Адрес отдельной строкой нужен, только если текст ссылки — название.
    this.#url.textContent = url && text !== url.href ? url.href : '';
  }

  #showLoading(url) {
    this.dataset.status = 'loading';
    this.setAttribute('aria-busy', 'true');
    this.#setLink(url, url.href);
    this.#title.textContent = '…';
    this.#heading.textContent = '…';
    this.#status.textContent = 'Загрузка…';
  }

  #showReady(url, title, heading) {
    this.#setLink(url, title || url.href);
    this.#title.textContent = title || MISSING_TITLE;
    this.#heading.textContent = heading || MISSING_HEADING;
    this.#status.textContent = '';
    this.removeAttribute('aria-busy');
    this.dataset.status = 'ready';
  }

  #showError(url, message) {
    this.#setLink(url, url ? url.href : 'Страница не указана');
    this.#title.textContent = MISSING_TITLE;
    this.#heading.textContent = MISSING_HEADING;
    this.#status.textContent = message;
    this.removeAttribute('aria-busy');
    this.dataset.status = 'error';
  }
}

if (!customElements.get('page-preview')) {
  customElements.define('page-preview', PagePreview);
}
